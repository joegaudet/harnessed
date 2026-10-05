import { getConfig, reviveStrictViolation } from '@harnessed-ts/core'
import type { Selector } from '@harnessed-ts/core'
import { encodeSelector, injectSource, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'
import { rememberUrl } from './location'
import { PageError, pageScript } from './page-script'
import type { ElementRef, PageOp, PageReply } from './page-script'

/**
 * Where a script runs and an element is acted on: the session itself for the
 * top-level document, or — under WebDriver BiDi — a frame's own browsing
 * context. Under WebDriver Classic a frame is entered by switching the session
 * into it, so the session is the realm there too.
 */
export type Realm = WebdriverIO.Browser | WebdriverIO.BrowsingContext

/** A document the driver is working in. */
export interface Site {
  readonly browser: WebdriverIO.Browser
  readonly realm: Realm
  /** Set when `realm` is a BiDi frame context rather than the session. */
  readonly context?: WebdriverIO.BrowsingContext
  /** The top-level document, whose URL is the page's URL. */
  readonly top: boolean
}

/** Sends keys to the focused element of the site's document. */
export function sendKeys(site: Site, keys: string[]): Promise<void> {
  return site.context === undefined ? site.browser.keys(keys) : site.context.keys(keys)
}

let classic: string | undefined

/**
 * The page script as a classic Execute Script body, which awaits the promise
 * the script returns.
 *
 * Calls into the top-level document go through the classic endpoint even in a
 * BiDi session, which keeps it — WebdriverIO's `switchWindow` moves both
 * together. Measured on Chrome, a BiDi `execute` here took 10–150ms where the
 * classic endpoint took 2–4ms, and the high end lands straight after a
 * navigation: exactly when a test asks whether something is there yet. A frame
 * entered under BiDi has only its BiDi context, so it uses that.
 */
function classicScript(): string {
  if (classic === undefined) classic = `return (${pageScript.toString()}).apply(null, arguments)`
  return classic
}

/** Sessions whose every new document already gets the resolver. */
const preloaded = new WeakSet<WebdriverIO.Browser>()

/**
 * Puts the resolver into a document that does not have it.
 *
 * The injectable build is around 190 KB, and how it travels matters: through
 * WebdriverIO's BiDi `execute` it takes 150–200ms, through the classic
 * Execute Script endpoint about 15ms. That gap decides whether an absence check
 * straight after navigation answers "immediately". So the top-level document
 * is injected through the classic endpoint, which a BiDi session keeps.
 *
 * Under BiDi the session also registers the resolver as a preload script, once:
 * every document opened afterwards — frames included — starts with it, and
 * navigation stops costing an injection at all. Registering takes 300ms or
 * more, so it is started and never awaited: no query waits on it. Until it
 * lands — and in any document it misses — the injection below still happens.
 */
async function inject(site: Site): Promise<void> {
  const { browser } = site
  const source = injectSource()
  if (browser.isBidi && !preloaded.has(browser)) {
    preloaded.add(browser)
    // Only an optimisation: without it, each document is injected on first use.
    browser
      .scriptAddPreloadScript({ functionDeclaration: `() => {\n${source}\n}` })
      .catch(() => undefined)
  }
  if (site.context === undefined) await browser.executeScript(source, [])
  else await site.context.execute(source)
}

/**
 * Runs one operation of the shared resolver in a document, injecting the
 * resolver first if the document does not have it yet.
 *
 * The presence check rides along with the call itself, so a document that
 * already has the resolver pays one round-trip, not two. Injecting happens once
 * per document: navigation replaces the window, and the resolver with it.
 */
export async function callPage(
  site: Site,
  op: PageOp,
  scope: readonly Selector[],
  selector: Selector,
  timeout: number,
  arg: string | null = null,
): Promise<unknown> {
  const args = [
    PAGE_API_GLOBAL,
    op,
    scope.map(encodeSelector),
    encodeSelector(selector),
    // The page cannot see this process's configure(), so the settings travel.
    { testIdAttribute: getConfig().testIdAttribute, timeout },
    arg,
  ] as const
  const ask = async () =>
    (site.context === undefined
      ? await site.browser.executeScript(classicScript(), [...args])
      : await site.context.execute(pageScript, ...args)) as PageReply
  let reply = await ask()
  if (reply.kind === 'missing') {
    await inject(site)
    reply = await ask()
  }
  if (reply.kind === 'missing') {
    throw new Error('harnessed: the resolver could not be injected into the page.')
  }
  // A strict violation comes back as core's own class, as under every driver.
  if (reply.kind === 'error') throw reviveStrictViolation(new PageError(reply.name, reply.message))
  if (site.top) rememberUrl(site.browser, reply.url)
  return reply.value
}

/** Wraps an element reference a script returned, in the document it came from. */
export async function wrap(site: Site, ref: ElementRef): Promise<WebdriverIO.Element> {
  return (await site.realm.$(ref)) as WebdriverIO.Element
}

/** A scope chain cut at a frame link: the links before it, and the link itself. */
interface Hop {
  scope: Selector[]
  link: Selector
}

function splitAtFrames(scope: readonly Selector[]): { hops: Hop[]; rest: Selector[] } {
  const hops: Hop[] = []
  let current: Selector[] = []
  for (const link of scope) {
    if (link.frame === true) {
      hops.push({ scope: current, link })
      current = []
    } else {
      current.push(link)
    }
  }
  return { hops, rest: current }
}

/** A non-waiting walk found a frame link that is not on screen. */
export class FrameAbsent extends Error {
  override name = 'FrameAbsent'
}

export interface WalkOptions {
  /** Wait for each frame link, or answer at once by throwing FrameAbsent. */
  waiting: boolean
  /** The budget for every hop and the operation together. */
  timeout: number
  /** Called with each iframe element, from its own document, before entering it. */
  onFrame?: (iframe: WebdriverIO.Element) => Promise<void>
}

/** The top-level browsing context the session is on, which BiDi frames hang off. */
async function topContext(browser: WebdriverIO.Browser): Promise<WebdriverIO.BrowsingContext> {
  const handle = await browser.getWindowHandle()
  const contexts = await browser.browsingContexts()
  const found = contexts.find(context => context.contextId === handle) ?? contexts[0]
  if (found === undefined) throw new Error('harnessed: the session has no browsing context.')
  return found
}

/**
 * Walks the scope chain's frame links, entering each frame, then runs the
 * operation in the innermost document with the links that remain.
 *
 * A WebDriver element belongs to one document: an element inside a frame cannot
 * be acted on from the top-level one, even where the page's own script could
 * reach it. So the shared resolver runs once per document — up to the iframe,
 * then inside it — and WebDriver does the crossing. That is also why
 * cross-origin frames work here, where an in-page resolver cannot enter them.
 *
 * Under Classic the session is switched back to the top-level document
 * afterwards, whatever happened; under BiDi each frame has a context of its own
 * and nothing needs restoring.
 */
export async function walk<T>(
  browser: WebdriverIO.Browser,
  scope: readonly Selector[],
  options: WalkOptions,
  operation: (site: Site, scope: Selector[], remaining: () => number) => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + options.timeout
  const remaining = () => Math.max(0, deadline - Date.now())
  const { hops, rest } = splitAtFrames(scope)
  let site: Site = { browser, realm: browser, top: true }
  // Under BiDi, the frame context entered last.
  let context: WebdriverIO.BrowsingContext | undefined
  let switched = false
  try {
    for (const hop of hops) {
      const op = options.waiting ? 'frame' : 'frameNow'
      const found = (await callPage(site, op, hop.scope, hop.link, remaining())) as {
        element: ElementRef | null
      }
      if (found.element === null) throw new FrameAbsent()
      const iframe = await wrap(site, found.element)
      await options.onFrame?.(iframe)
      if (browser.isBidi) {
        context = await (context ?? (await topContext(browser))).frame(iframe)
        site = { browser, realm: context, context, top: false }
      } else {
        await browser.switchFrame(iframe)
        switched = true
        site = { browser, realm: browser, top: false }
      }
    }
    return await operation(site, rest, remaining)
  } finally {
    if (switched) await browser.switchFrame(null)
  }
}
