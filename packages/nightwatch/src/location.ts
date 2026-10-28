import type { NightwatchAPI } from 'nightwatch'

/**
 * The last top-level URL the driver saw, per session.
 *
 * Core's navigation contract reads the current URL synchronously, but WebDriver
 * only answers over the wire. So every round-trip the driver already makes to
 * the top-level document brings the URL back with it, as do `goto()` and every
 * poll of `waitForUrl()`. Nothing pays an extra command to keep it fresh.
 */
const seen = new WeakMap<NightwatchAPI, string>()

export function rememberUrl(browser: NightwatchAPI, url: string): void {
  seen.set(browser, url)
}

export function lastUrl(browser: NightwatchAPI): string {
  const url = seen.get(browser)
  if (url === undefined) {
    throw new Error(
      'harnessed: the nightwatch driver has not seen a URL yet. Navigate with goto(), ' +
        'or wait with assertPathname(), before reading currentUrl.',
    )
  }
  return url
}
