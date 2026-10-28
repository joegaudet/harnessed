import type { Selector } from '@harnessed-ts/core'
import {
  callPage as callShared,
  classicScript,
  pageScript,
  walk as walkShared,
} from '@harnessed-ts/resolve/webdriver'
import type {
  ElementRef,
  PageOp,
  WalkOptions as SharedWalkOptions,
  WebDriverLike,
  WebDriverSite,
} from '@harnessed-ts/resolve/webdriver'
import { rememberUrl } from './location'

export { FrameAbsent } from '@harnessed-ts/resolve/webdriver'

/**
 * Where a script runs and an element is acted on: the session itself for the
 * top-level document, or — under WebDriver BiDi — a frame's own browsing
 * context. Under WebDriver Classic a frame is entered by switching the session
 * into it, so the session is the realm there too.
 */
export type Realm = WebdriverIO.Browser | WebdriverIO.BrowsingContext

/** A document the driver is working in. */
export interface Site extends WebDriverSite {
  readonly browser: WebdriverIO.Browser
  readonly realm: Realm
  /** Set when `realm` is a BiDi frame context rather than the session. */
  readonly context?: WebdriverIO.BrowsingContext
}

/** Sends keys to the focused element of the site's document. */
export function sendKeys(site: Site, keys: string[]): Promise<void> {
  return site.context === undefined ? site.browser.keys(keys) : site.context.keys(keys)
}

/** Sessions whose every new document already gets the resolver. */
const preloaded = new WeakSet<WebdriverIO.Browser>()

/** The top-level browsing context the session is on, which BiDi frames hang off. */
async function topContext(browser: WebdriverIO.Browser): Promise<WebdriverIO.BrowsingContext> {
  const handle = await browser.getWindowHandle()
  const contexts = await browser.browsingContexts()
  const found = contexts.find(context => context.contextId === handle) ?? contexts[0]
  if (found === undefined) throw new Error('harnessed: the session has no browsing context.')
  return found
}

/**
 * The shared WebDriver code's view of a WebdriverIO session.
 *
 * Calls into the top-level document go through the classic Execute Script
 * endpoint even in a BiDi session, which keeps it — WebdriverIO's
 * `switchWindow` moves both together. Measured on Chrome, a BiDi `execute` here
 * took 10–150ms where the classic endpoint took 2–4ms, and the high end lands
 * straight after a navigation: exactly when a test asks whether something is
 * there yet. A frame entered under BiDi has only its BiDi context, so it uses
 * that.
 */
function webdriverOf(browser: WebdriverIO.Browser): WebDriverLike<Site, WebdriverIO.Element> {
  return {
    top: () => ({ browser, realm: browser, top: true, origin: { x: 0, y: 0 } }),
    run: (site, args) =>
      site.context === undefined
        ? site.browser.executeScript(classicScript(), [...args])
        : site.context.execute(pageScript, ...args),
    /**
     * The injectable build is around 190 KB, and how it travels matters:
     * through WebdriverIO's BiDi `execute` it takes 150–200ms, through the
     * classic Execute Script endpoint about 15ms. That gap decides whether an
     * absence check straight after navigation answers "immediately". So the
     * top-level document is injected through the classic endpoint, which a BiDi
     * session keeps.
     *
     * Under BiDi the session also registers the resolver as a preload script,
     * once: every document opened afterwards — frames included — starts with
     * it, and navigation stops costing an injection at all. Registering takes
     * 300ms or more, so it is started and never awaited: no query waits on it.
     * Until it lands — and in any document it misses — the injection below
     * still happens.
     */
    async inject(site, source) {
      if (browser.isBidi && !preloaded.has(browser)) {
        preloaded.add(browser)
        // Only an optimisation: without it, each document is injected on first use.
        browser
          .scriptAddPreloadScript({ functionDeclaration: `() => {\n${source}\n}` })
          .catch(() => undefined)
      }
      if (site.context === undefined) await browser.executeScript(source, [])
      else await site.context.execute(source)
    },
    element: (site, ref) => wrap(site, ref),
    /**
     * Under BiDi each frame has a browsing context of its own, and nothing
     * needs restoring; under Classic the session is switched into the frame.
     */
    async enterFrame(site, iframe, origin) {
      if (browser.isBidi) {
        const context = await (site.context ?? (await topContext(browser))).frame(iframe)
        return { browser, realm: context, context, top: false, origin }
      }
      await browser.switchFrame(iframe)
      return { browser, realm: browser, top: false, origin }
    },
    async leaveFrames() {
      if (!browser.isBidi) await browser.switchFrame(null)
    },
    sawUrl: url => rememberUrl(browser, url),
  }
}

const adapters = new WeakMap<WebdriverIO.Browser, WebDriverLike<Site, WebdriverIO.Element>>()

function adapterFor(browser: WebdriverIO.Browser): WebDriverLike<Site, WebdriverIO.Element> {
  let adapter = adapters.get(browser)
  if (adapter === undefined) {
    adapter = webdriverOf(browser)
    adapters.set(browser, adapter)
  }
  return adapter
}

/**
 * Runs one operation of the shared resolver in a document, injecting the
 * resolver first if the document does not have it yet.
 */
export function callPage(
  site: Site,
  op: PageOp,
  scope: readonly Selector[],
  selector: Selector,
  timeout: number,
  arg: string | null = null,
): Promise<unknown> {
  return callShared(adapterFor(site.browser), site, op, scope, selector, timeout, arg)
}

/** Wraps an element reference a script returned, in the document it came from. */
export async function wrap(site: Site, ref: ElementRef): Promise<WebdriverIO.Element> {
  return (await site.realm.$(ref)) as WebdriverIO.Element
}

export type WalkOptions = SharedWalkOptions<WebdriverIO.Element>

/**
 * Walks the scope chain's frame links, entering each frame through WebDriver,
 * then runs the operation in the innermost document — see the shared `walk`.
 * Under Classic the session is switched back to the top-level document
 * afterwards, whatever happened.
 */
export function walk<T>(
  browser: WebdriverIO.Browser,
  scope: readonly Selector[],
  options: WalkOptions,
  operation: (site: Site, scope: Selector[], remaining: () => number) => Promise<T>,
): Promise<T> {
  return walkShared(adapterFor(browser), scope, options, operation)
}
