import { navigationFor, ScopedHarness, timeoutFor } from '@harnessed-ts/core'
import type { EnvConfig, Navigation } from '@harnessed-ts/core'

/** No declared params means `goto()` takes no argument; declaring some makes it required. */
export type GotoArgs<Params> = [keyof Params] extends [never]
  ? [params?: undefined]
  : [params: Params]

/**
 * One test object per URL: where it lives, how to get there, and how to know it
 * has arrived.
 *
 * Takes an `EnvConfig` like every other harness and runs on the driver's
 * navigation capability — so any driver that can drive an address bar gets routes
 * for free, and one that cannot (jsdom has no URL to navigate) says so in one
 * readable error at construction. Host plumbing (`self`, `elementBy`,
 * `childHarness`) comes from `ScopedHarness`, shared with `ComponentHarness`.
 *
 * `Params` declares the substitutions the path needs, so `goto()` is checked
 * against the path rather than trusted.
 */
export abstract class RouteHarness<
  Params extends Record<string, string> = Record<never, never>,
> extends ScopedHarness {
  private readonly navigation: Navigation

  constructor(env: EnvConfig) {
    super(env)
    // Resolved eagerly so an env that cannot navigate fails here, at the
    // construction site, rather than inside the first goto() somewhere later.
    this.navigation = navigationFor(env)
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
   * The usual body is one line against the route's own host:
   *
   * ```ts
   * protected async waitForReady(): Promise<void> {
   *   await this.self.waitFor('visible')
   * }
   * ```
   */
  protected abstract waitForReady(): Promise<void>

  async goto(...[params]: GotoArgs<Params>): Promise<void> {
    await this.navigation.goto(this._env, this.resolvePath(params))
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
    return this.navigation.currentUrl(this._env)
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
   * Matches on the pathname only: testing the whole URL means `/checkout` stops
   * matching the moment the page carries a query string — which is exactly when a
   * route assertion matters.
   */
  async assertPathname(expected: string | RegExp, options?: { timeout?: number }): Promise<void> {
    await this.navigation.waitForUrl(
      this._env,
      ({ pathname }) =>
        typeof expected === 'string' ? pathname === expected : expected.test(pathname),
      timeoutFor(options?.timeout),
    )
  }
}
