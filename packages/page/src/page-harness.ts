import { navigationFor, ScopedHarness, timeoutFor } from '@harnessed-ts/core'
import type { EnvConfig, Navigation, Selector, WaitOptions } from '@harnessed-ts/core'
import { nestedInFrame, noPath, notReady, notReadyWithin } from './errors'

/** No declared params means `goto()` takes no argument; declaring some makes it required. */
export type GotoArgs<Params> = [keyof Params] extends [never]
  ? [params?: undefined]
  : [params: Params]

/**
 * What `transitionTo` needs of its target: something that can say when it has
 * arrived. Structural on purpose — a constraint of `T extends PageHarness` would
 * reject every page that declares params, because `GotoArgs` makes the `goto`
 * signature differ between pages with and without them.
 */
export interface Readiness {
  expectReady(options?: WaitOptions): Promise<void>
}

export interface PageHarnessConstructor<
  T extends ScopedHarness & Readiness = ScopedHarness & Readiness,
> {
  new (env: EnvConfig, parentScope?: readonly Selector[]): T
  readonly name: string
}

/**
 * One test object per screen: what it is composed of, how to know it has
 * arrived, and — when it has a URL — how to get there.
 *
 * Takes an `EnvConfig` like every other harness and constructs under every
 * driver. Navigation is resolved lazily, so a page runs unchanged in a jsdom test
 * (rendered, then `expectReady()`) and in a browser (`goto()`); only the URL
 * members need a driver that can drive an address bar, and they say so in one
 * readable error when handed one that cannot.
 *
 * Host plumbing (`self`, `elementBy`, `childHarness`) comes from
 * `ScopedHarness`, shared with `ComponentHarness`. A page nests component
 * harnesses and other pages alike with `@ChildHarness`.
 *
 * `Params` declares the substitutions the path needs, so `goto()` is checked
 * against the path rather than trusted.
 */
/** What the timer resolves with, so a timeout is told apart from a readiness failure. */
const EXPIRED = Symbol('harnessed.expired')

export abstract class PageHarness<Params extends Record<string, string> = Record<never, never>>
  extends ScopedHarness
  implements Readiness
{
  /**
   * The URL, with `$name` standing in for each declared param. Substitution is a
   * plain textual replace, so it works in the query string as well as the path.
   *
   * `undefined` — the default — for a page reached by interaction rather than by
   * URL. `goto()` on such a page is a readable refusal, not a silent no-op.
   */
  get path(): string | undefined {
    return undefined
  }

  /**
   * Runs automatically after `goto()` and behind `expectReady()`. Never leave it
   * empty: without it a test races the page and fails somewhere later, where the
   * cause is not visible.
   *
   * The usual body is one line against the page's own host:
   *
   * ```ts
   * protected async waitForReady(): Promise<void> {
   *   await this.self.waitFor('visible')
   * }
   * ```
   */
  protected abstract waitForReady(): Promise<void>

  /**
   * Resolves once the page has arrived, or rejects naming the page. The way a
   * test waits for a page it reached by interaction.
   *
   * With no `timeout`, the wait is bounded only by whatever `waitForReady()`
   * itself waits on — the same as `goto()` has always behaved, so a readiness
   * check that chains several waits is not cut short by a second clock. An
   * explicit `timeout` adds that clock, for a probe that must give up early.
   */
  async expectReady(options?: WaitOptions): Promise<void> {
    const name = this.constructor.name
    const inner = this.waitForReady()
    if (options?.timeout === undefined) {
      try {
        await inner
      } catch (cause) {
        throw notReady(name, cause)
      }
      return
    }

    const timeout = timeoutFor(options.timeout)
    // A wait that loses the race would otherwise surface as an unhandled
    // rejection once its own timeout elapses.
    inner.catch(() => {})
    let timer: ReturnType<typeof setTimeout> | undefined
    const expired = new Promise<typeof EXPIRED>(resolve => {
      timer = setTimeout(() => resolve(EXPIRED), timeout)
    })
    let winner: void | typeof EXPIRED
    try {
      winner = await Promise.race([inner, expired])
    } catch (cause) {
      throw notReady(name, cause)
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
    if (winner === EXPIRED) throw notReadyWithin(name, timeout)
  }

  /**
   * Whether the page arrives. Never throws. Pass a short `timeout` to probe;
   * `isAbsent()` remains the immediate check. Note that the subclass's own wait
   * keeps polling until its own timeout after a probe returns — it is
   * abandoned, not cancelled.
   */
  async isReady(options?: WaitOptions): Promise<boolean> {
    try {
      await this.expectReady(options)
      return true
    } catch {
      return false
    }
  }

  async goto(...[params]: GotoArgs<Params>): Promise<void> {
    // The page's own facts first, then the driver's: a missing path is the
    // cheaper and more local mistake.
    this.requirePath()
    await this.navigation.goto(this._env, this.resolvePath(params))
    await this.expectReady()
  }

  /** Every occurrence of each `$name` replaced with its URL-encoded value. */
  protected resolvePath(params?: Params): string {
    let resolved = this.requirePath()
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
   * page assertion matters.
   */
  async assertPathname(expected: string | RegExp, options?: WaitOptions): Promise<void> {
    await this.navigation.waitForUrl(
      this._env,
      ({ pathname }) =>
        typeof expected === 'string' ? pathname === expected : expected.test(pathname),
      timeoutFor(options?.timeout),
    )
  }

  /**
   * The page an interaction leads to: constructed with this page's env and
   * parent scope, and awaited until ready. The return type is what lets an action
   * read `await login.submit()` and hand back a `DashboardPage`.
   *
   * Sibling scope on purpose: a wizard step nested under a wizard page moves to
   * the next step under the same wizard; two root pages both sit at the root.
   */
  protected async transitionTo<T extends ScopedHarness & Readiness>(
    PageClass: PageHarnessConstructor<T>,
    options?: WaitOptions,
  ): Promise<T> {
    const next = new PageClass(this._env, this._parentScope)
    await next.expectReady(options)
    return next
  }

  /** Resolved per access, never cached: a page constructs under any driver. */
  private get navigation(): Navigation {
    // A page whose own host is a frame still lives at the top-level URL.
    if (this._parentScope.some(link => link.frame === true)) {
      throw nestedInFrame(this.constructor.name)
    }
    return navigationFor(this._env)
  }

  private requirePath(): string {
    const path = this.path
    if (path === undefined) throw noPath(this.constructor.name)
    return path
  }
}
