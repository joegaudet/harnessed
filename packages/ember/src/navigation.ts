import { currentURL, visit } from '@ember/test-helpers'
import { registerNavigation } from '@harnessed-ts/core'
import { waitFor as waitForCondition } from '@testing-library/dom'
import { EMBER_DRIVER } from './driver-id'

/**
 * The router's URL, made absolute. An application test drives the router, not
 * the address bar — its location is `none` — so `currentURL()` is the truth and
 * `window.location` is not. Absolute because a page reads `pathname` and
 * `searchParams` off it with `new URL()`.
 */
function absolute(): string {
  return new URL(currentURL() ?? '/', window.location.origin).href
}

/**
 * Navigation through the router, in application tests. A rendering test has no
 * router to drive; there, `visit` and `currentURL` refuse with test-helpers'
 * own message.
 */
registerNavigation(EMBER_DRIVER, {
  async goto(_env, url) {
    // visit() resolves once the transition, and everything it scheduled, settles.
    await visit(url)
  },
  currentUrl() {
    return absolute()
  },
  async waitForUrl(_env, matches, timeout) {
    await waitForCondition(
      () => {
        if (!matches(new URL(absolute()))) throw new Error(`still at ${absolute()}`)
      },
      { timeout },
    )
  },
})
