import { json, mock } from '@harnessed-ts/mock'
import type { Page } from '@playwright/test'
import { pw } from './env'
import './mock-transport'

export interface ApiStubRoutes<Stubs> {
  /**
   * Pathname (or a suffix of one) to the body it answers with. A function receives
   * the mutable stub state, so a setup step can reshape a response before the
   * navigation that reads it.
   */
  [pathname: string]: (stubs: Stubs) => unknown
}

export interface ApiStubOptions<Stubs> {
  /** Which requests the stubs answer: a glob over the URL path, as `mock()` matches it. */
  pattern?: string
  routes: ApiStubRoutes<Stubs>
  /** Fresh state per test. Cloned, so one test cannot leak into the next. */
  defaults: Stubs
  /** When true, requests go to the real backend instead of the stubs. */
  live?: () => boolean
  /** Answer for a matched pattern with no route entry. Defaults to `{ ok: true }`. */
  fallback?: (pathname: string, stubs: Stubs) => unknown
}

export interface InstalledStubs<Stubs> {
  stubs: Stubs
  install(page: Page): Promise<void>
}

/**
 * Fulfils API requests from an in-memory object so a browser suite runs with no
 * backend and no database.
 *
 * @deprecated Use `mock()` from `@harnessed-ts/playwright/mock`, which does this
 * under every runner, not only Playwright. `createApiStubs` is now built on it
 * and is removed in the next minor.
 *
 * Deliberately not a Playwright fixture: fixture plumbing differs between plain
 * Playwright and playwright-bdd, so this returns the pieces and the caller wires
 * them into whichever `test` they have.
 *
 * A green stubbed run is not a promise that the real endpoints work — keep a
 * separate check against a deployed environment.
 */
export function createApiStubs<Stubs extends object>(
  options: ApiStubOptions<Stubs>,
): InstalledStubs<Stubs> {
  const {
    pattern = '**/api/**',
    routes,
    defaults,
    live = () => false,
    fallback = () => ({ ok: true }),
  } = options

  const stubs = structuredClone(defaults)
  // Built once: the table is captured and never mutated, and this ran on every
  // intercepted request.
  const pathnames = Object.keys(routes)

  return {
    stubs,
    async install(page: Page): Promise<void> {
      if (live()) return
      // Requests outside the pattern went to the network before; they still do.
      const api = mock(pw(page), { onUnhandled: 'bypass' })
      await api.all(pattern).reply(({ url }) => {
        const pathname = url.pathname
        const match = pathnames.find(key => pathname.endsWith(key))
        return json(match === undefined ? fallback(pathname, stubs) : routes[match]!(stubs))
      })
    },
  }
}
