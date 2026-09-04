import type { Page } from '@playwright/test'

export interface ApiStubRoutes<Stubs> {
  /**
   * Pathname (or a suffix of one) to the body it answers with. A function receives
   * the mutable stub state, so a setup step can reshape a response before the
   * navigation that reads it.
   */
  [pathname: string]: (stubs: Stubs) => unknown
}

export interface ApiStubOptions<Stubs> {
  /** Glob passed to `page.route`. */
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

  return {
    stubs,
    async install(page: Page): Promise<void> {
      if (live()) return
      await page.route(pattern, async route => {
        const pathname = new URL(route.request().url()).pathname
        const match = Object.keys(routes).find(key => pathname.endsWith(key))
        const body = match === undefined ? fallback(pathname, stubs) : routes[match]!(stubs)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })
      })
    },
  }
}
