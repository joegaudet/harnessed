import { currentURL, settled, visit } from '@ember/test-helpers'
import { registerNavigation } from '@harnessed-ts/core'
import { waitFor as waitForCondition } from '@testing-library/dom'
import { EMBER_DRIVER } from './driver-id'

/**
 * The router's URL, made absolute. An application test drives the router, not
 * the address bar — its location is `none` — so `currentURL()` is the truth and
 * `window.location` is not. Absolute because a page reads `pathname` and
 * `searchParams` off it with `new URL()`.
 *
 * There is not always a router URL: a rendering test has no router, and an
 * application test has none until its first visit. Reading that as `/` would
 * let `assertPathname('/')` pass before anything navigated, so it refuses.
 */
function absolute(): string {
  const url = currentURL()
  if (url == null) {
    throw new Error(
      'harnessed: the app has not visited a URL. A rendering test has no router; ' +
        'in an application test, call visit() or a page’s goto() first.',
    )
  }
  return new URL(url, window.location.origin).href
}

/** Navigation through the router, in application tests. */
registerNavigation(EMBER_DRIVER, {
  async goto(_env, url) {
    // visit() resolves once the transition, and everything it scheduled, settles.
    await visit(url)
  },
  currentUrl() {
    return absolute()
  },
  async waitForUrl(_env, matches, timeout) {
    // Outside the retry loop: no router is a refusal, not something to wait out.
    absolute()
    await waitForCondition(
      () => {
        if (!matches(new URL(absolute()))) throw new Error(`still at ${absolute()}`)
      },
      { timeout },
    )
    // The URL changes before the destination has rendered.
    await settled()
  },
})
