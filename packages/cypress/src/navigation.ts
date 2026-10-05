import { registerNavigation } from '@harnessed-ts/core'
import type { EnvConfig } from '@harnessed-ts/core'
import { CYPRESS_DRIVER } from './driver-id'
import type { CypressEnv } from './env'

const POLL_MS = 20

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Where a relative URL is resolved from: Cypress's `baseUrl`, as Playwright
 * resolves against its `baseURL` — never the page the AUT happens to be on, or
 * the same `goto('step-two')` would land somewhere different from each page.
 * Without a `baseUrl`, the AUT's own URL is the only base there is; the AUT
 * starts each test on `about:blank`, which resolves nothing.
 */
function baseOf(window: Window): string | undefined {
  const baseUrl = Cypress.config('baseUrl')
  if (baseUrl !== null && baseUrl !== '') return baseUrl
  if (/^https?:$/.test(window.location.protocol)) return window.location.href
  return undefined
}

function resolveUrl(window: Window, url: string): URL {
  try {
    return new URL(url, baseOf(window))
  } catch {
    throw new Error(
      `harnessed: cannot resolve "${url}": the application under test has not loaded a ` +
        `page yet and Cypress has no baseUrl. Set baseUrl, or pass an absolute URL.`,
    )
  }
}

/** Only the fragment differs, so the browser scrolls instead of loading a document. */
function sameDocument(from: string, to: URL): boolean {
  const current = new URL(from)
  return to.hash !== '' && current.href.split('#')[0] === to.href.split('#')[0]
}

/**
 * Navigates inside the bridge's promise. Assigning `location.href` asks the AUT
 * frame to load a new document; Cypress sees the load the same way it sees a link
 * click and re-instruments the page. What the promise has to wait for is the
 * swap itself — the old document gone and the new one parsed — which is what
 * Playwright's `domcontentloaded` waits for too. Readiness beyond that is the
 * page's own `expectReady()`.
 */
async function goto(env: EnvConfig, url: string): Promise<void> {
  if (Cypress.testingType === 'component') {
    throw new Error(
      'harnessed: goto() cannot run in component testing — the component is mounted in ' +
        'the spec frame, so navigating it would end the test. Navigate in an e2e spec, ' +
        'or mount the screen you want.',
    )
  }
  const { window } = env as CypressEnv
  const leaving = window.document
  const target = resolveUrl(window, url)
  const sameDoc =
    window.location.protocol !== 'about:' && sameDocument(window.location.href, target)
  window.location.href = target.href
  if (sameDoc) return

  // A first load through Vite's dev server can take a while; Cypress's own
  // budget for a page load is the honest one to wait out.
  const timeout = Cypress.config('pageLoadTimeout')
  const deadline = Date.now() + timeout
  for (;;) {
    const document = window.document
    if (document !== leaving && document.readyState !== 'loading') return
    if (Date.now() > deadline) {
      throw new Error(`harnessed: ${target.href} did not load within ${timeout}ms.`)
    }
    await sleep(POLL_MS)
  }
}

/**
 * This driver can navigate, so it registers the capability a page's `goto()`
 * runs on. `currentUrl` and `waitForUrl` read the AUT's own location, which is
 * always the live one: `window` is the frame's WindowProxy.
 */
registerNavigation(CYPRESS_DRIVER, {
  goto,
  currentUrl(env) {
    return (env as CypressEnv).window.location.href
  },
  async waitForUrl(env, matches, timeout) {
    const { window } = env as CypressEnv
    const deadline = Date.now() + timeout
    while (!matches(new URL(window.location.href))) {
      if (Date.now() > deadline) {
        throw new Error(
          `harnessed: the URL did not match within ${timeout}ms; it is ${window.location.href}.`,
        )
      }
      await sleep(POLL_MS)
    }
  },
})
