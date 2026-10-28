import type { Selector } from '@harnessed-ts/core'
import {
  callPage as callShared,
  classicScript,
  walk as walkShared,
} from '@harnessed-ts/resolve/webdriver'
import type {
  PageOp,
  WalkOptions as SharedWalkOptions,
  WebDriverLike,
  WebDriverSite,
} from '@harnessed-ts/resolve/webdriver'
import type { NightwatchAPI } from 'nightwatch'
import { rememberUrl } from './location'

export { FrameAbsent } from '@harnessed-ts/resolve/webdriver'

/** The selenium-webdriver session Nightwatch drives, as `browser.driver`. */
export type Driver = NightwatchAPI['driver']
/** A selenium-webdriver element: what a script returns for a node, and what acts on it. */
export type Element = Awaited<ReturnType<Driver['findElement']>>

/**
 * A document the driver is working in. Nightwatch's session speaks WebDriver
 * Classic, where a frame is entered by switching the session into it, so the
 * session is where every script runs; the site only says where its viewport sits.
 */
export type Site = WebDriverSite

/**
 * The shared WebDriver code's view of a Nightwatch session.
 *
 * Every script goes to selenium-webdriver's `executeScript` on `browser.driver`
 * — what Nightwatch's own `execute` command calls underneath — rather than
 * through the command: that command swallows a script error (logging it and
 * resolving `null`) and retries a failed script, and the page script both
 * reports its own errors as values and must not run twice. Elements come back
 * as `WebElement`s, ready to act on.
 */
function webdriverOf(browser: NightwatchAPI): WebDriverLike<Site, Element> {
  const driver = (): Driver => browser.driver
  return {
    top: () => ({ top: true, origin: { x: 0, y: 0 } }),
    run: (_site, args) => driver().executeScript(classicScript(), ...args),
    async inject(_site, source) {
      await driver().executeScript(source)
    },
    // selenium-webdriver already turned the reference into a WebElement.
    element: async (_site, ref) => ref as object as Element,
    async enterFrame(_site, iframe, origin) {
      await driver().switchTo().frame(iframe)
      return { top: false, origin }
    },
    async leaveFrames() {
      await driver().switchTo().defaultContent()
    },
    sawUrl: url => rememberUrl(browser, url),
  }
}

const adapters = new WeakMap<NightwatchAPI, WebDriverLike<Site, Element>>()

export function adapterFor(browser: NightwatchAPI): WebDriverLike<Site, Element> {
  let adapter = adapters.get(browser)
  if (adapter === undefined) {
    adapter = webdriverOf(browser)
    adapters.set(browser, adapter)
  }
  return adapter
}

/**
 * Runs one operation of the shared resolver in the site's document, injecting
 * the resolver first if the document does not have it yet.
 */
export function callPage(
  browser: NightwatchAPI,
  site: Site,
  op: PageOp,
  scope: readonly Selector[],
  selector: Selector,
  timeout: number,
  arg: string | null = null,
): Promise<unknown> {
  return callShared(adapterFor(browser), site, op, scope, selector, timeout, arg)
}

export type WalkOptions = SharedWalkOptions<Element>

/**
 * Walks the scope chain's frame links, switching the session into each frame,
 * then runs the operation in the innermost document — see the shared `walk`.
 * The session is switched back to the top-level document afterwards, whatever
 * happened.
 */
export function walk<T>(
  browser: NightwatchAPI,
  scope: readonly Selector[],
  options: WalkOptions,
  operation: (site: Site, scope: Selector[], remaining: () => number) => Promise<T>,
): Promise<T> {
  return walkShared(adapterFor(browser), scope, options, operation)
}
