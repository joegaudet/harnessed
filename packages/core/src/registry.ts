import type { EnvConfig } from './env'
import { globals } from './globals'
import type { Query } from './query'
import type { Selector } from './selector'

export type QueryFactory = (env: EnvConfig, scope: readonly Selector[], selector: Selector) => Query

/**
 * What a driver that can drive a browser's address bar provides. Optional: a
 * jsdom driver has no URL to navigate, and that is fine — only a `PageHarness`'s
 * URL members need this, and they say so clearly when handed an env that cannot.
 */
export interface Navigation {
  /** Navigate to a URL and wait for the document to be ready enough to query. */
  goto(env: EnvConfig, url: string): Promise<void>
  currentUrl(env: EnvConfig): string
  /** Resolve once the current URL satisfies the predicate. */
  waitForUrl(env: EnvConfig, matches: (url: URL) => boolean, timeout: number): Promise<void>
}

/**
 * Registers a driver under an id. Core knows nothing about any driver: each one
 * registers itself when imported, which is what keeps this package installable
 * without Playwright or Testing Library present.
 */
export function registerDriver(id: string, factory: QueryFactory): void {
  globals().drivers.set(id, factory)
}

export function registeredDrivers(): string[] {
  return [...globals().drivers.keys()].sort()
}

/** Declares that a driver can navigate. Registered alongside its QueryFactory. */
export function registerNavigation(id: string, navigation: Navigation): void {
  globals().navigations.set(id, navigation)
}

/**
 * Work a page must wait for before it navigates: `@harnessed-ts/mock` uses it so
 * a request fired while the page loads is answered by a mock the test set up
 * just before `goto()`. `page` is the page harness about to navigate.
 */
export type BeforeNavigate = (env: EnvConfig, page: object) => Promise<void>

/**
 * Registers work every `goto()` awaits before navigating. Lives in core so a
 * package can hook navigation without `@harnessed-ts/page` depending on it.
 * Keyed rather than listed: a module evaluated twice (an ESM and a CJS copy)
 * replaces its own hook instead of running it twice.
 */
export function registerBeforeNavigate(key: string, hook: BeforeNavigate): void {
  globals().beforeNavigate.set(key, hook)
}

/** Runs every registered `BeforeNavigate` hook, in registration order. */
export async function beforeNavigate(env: EnvConfig, page: object): Promise<void> {
  for (const hook of globals().beforeNavigate.values()) await hook(env, page)
}

/** The navigation capability for an env, or a readable refusal. */
export function navigationFor(env: EnvConfig): Navigation {
  const navigation = globals().navigations.get(env.driver)
  if (navigation === undefined) {
    const capable = [...globals().navigations.keys()].sort()
    const suffix =
      capable.length === 0
        ? 'No registered driver can navigate. Import a browser driver for its side effect, e.g. `import { pw } from "@harnessed-ts/playwright"`.'
        : `Drivers that can: ${capable.join(', ')}.`
    throw new Error(
      `harnessed: the "${env.driver}" driver cannot navigate, so a page cannot navigate with it. ${suffix}`,
    )
  }
  return navigation
}

/** The one place a driver is chosen. Everything after this is driver-agnostic. */
export function createQuery(env: EnvConfig, scope: readonly Selector[], selector: Selector): Query {
  const factory = globals().drivers.get(env.driver)
  if (factory === undefined) {
    const known = registeredDrivers()
    const suffix =
      known.length === 0
        ? 'No driver is registered. Import a driver package for its side effect, e.g. `import { dom } from "@harnessed-ts/dom"`.'
        : `Registered drivers: ${known.join(', ')}.`
    throw new Error(`harnessed: no driver registered for "${env.driver}". ${suffix}`)
  }
  return factory(env, scope, selector)
}
