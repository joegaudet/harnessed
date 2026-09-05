import { createQuery, requireHostMeta, timeoutFor } from '@harnessed/core'
import type {
  ComponentHarness,
  ComponentHarnessConstructor,
  EnvConfig,
  HarnessHost,
  Query,
  Selector,
} from '@harnessed/core'
import { pw } from '@harnessed/playwright'
import type { Page } from '@playwright/test'

/** No declared params means `goto()` takes no argument; declaring some makes it required. */
export type GotoArgs<Params> = [keyof Params] extends [never]
  ? [params?: undefined]
  : [params: Params]

/**
 * One test object per URL: where it lives, how to get there, and how to know it
 * has arrived.
 *
 * Playwright only — route behaviour means navigation, the URL, and whatever the
 * page fetches on the way in. Faking all of that under jsdom would prove that the
 * markup renders and nothing else.
 *
 * `Params` declares the substitutions the path needs, so `goto()` is checked
 * against the path rather than trusted.
 */
export abstract class RouteHarness<
  Params extends Record<string, string> = Record<never, never>,
> implements HarnessHost {
  /** @internal */ _env: EnvConfig
  /** @internal */ _scope: Selector[]

  constructor(protected readonly page: Page) {
    const { host } = requireHostMeta(this.constructor as { name?: string })
    this._env = pw(page)
    this._scope = [host]
  }

  /**
   * The URL, with `$name` standing in for each declared param. Substitution is a
   * plain textual replace, so it works in the query string as well as the path.
   */
  abstract get path(): string

  /**
   * Runs automatically after `goto()`. Never leave it empty: without it a test
   * races the page and fails somewhere later, where the cause is not visible.
   *
   * This is the one place a subclass should touch `this.page`.
   */
  protected abstract waitForReady(): Promise<void>

  async goto(...[params]: GotoArgs<Params>): Promise<void> {
    await this.page.goto(this.resolvePath(params), { waitUntil: 'domcontentloaded' })
    await this.waitForReady()
  }

  /** Every occurrence of each `$name` replaced with its URL-encoded value. */
  protected resolvePath(params?: Params): string {
    let resolved = this.path
    for (const [key, value] of Object.entries(params ?? {})) {
      resolved = resolved.replaceAll(`$${key}`, encodeURIComponent(value as string))
    }
    return resolved
  }

  get currentUrl(): string {
    return this.page.url()
  }

  get currentPathname(): string {
    return new URL(this.currentUrl).pathname
  }

  get currentSearchParams(): URLSearchParams {
    return new URL(this.currentUrl).searchParams
  }

  /**
   * Waits for the pathname to match, rather than asserting whatever it happens to
   * be right now.
   *
   * Matches on the pathname only. Handing the expectation to Playwright as a glob
   * would test it against the whole URL, so `/checkout` would stop matching the
   * moment the page carried a query string — which is exactly when a route
   * assertion matters.
   */
  async assertPathname(expected: string | RegExp, options?: { timeout?: number }): Promise<void> {
    await this.page.waitForURL(
      url => {
        const { pathname } = url
        return typeof expected === 'string' ? pathname === expected : expected.test(pathname)
      },
      // Without this the configured default silently did not apply here.
      { timeout: timeoutFor(options?.timeout) },
    )
  }

  /** A target whose selector is only known at call time. Keeps the route's scope. */
  protected elementBy(selector: Selector): Query {
    return createQuery(this._env, this._scope, selector)
  }

  /** A screen harness nested inside this URL, inheriting its scope. */
  protected childHarness<T extends ComponentHarness>(
    HarnessClass: ComponentHarnessConstructor<T>,
  ): T {
    return new HarnessClass(this._env, this._scope)
  }
}
