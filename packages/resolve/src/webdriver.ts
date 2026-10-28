import { checkTestIds, getConfig, reviveStrictViolation } from '@harnessed-ts/core'
import type { Selector } from '@harnessed-ts/core'
import type { Point } from './box'
import { injectSource } from './inject'
import { PAGE_API_GLOBAL } from './global-name'
import { encodeSelector } from './wire'
import { PageError, pageScript } from './webdriver-page-script'
import type { ElementRef, PageOp, PageReply } from './webdriver-page-script'

export { isFrameEntryError, PageError, pageScript } from './webdriver-page-script'
export type { ElementRef, PageOp, PageReply } from './webdriver-page-script'
export type { Point } from './box'

/** What `pageScript` takes, in order: what every `WebDriverLike.run` passes it. */
export type PageScriptArgs = Parameters<typeof pageScript>

/**
 * A document a WebDriver client is working in: the top-level one, or a frame's
 * a walk entered. A driver extends it with whatever it needs to address that
 * document (a BiDi browsing context, say).
 */
export interface WebDriverSite {
  /** The top-level document, whose URL is the page's URL. */
  readonly top: boolean
  /** Where this document's viewport starts in the top-level one, in CSS pixels. */
  readonly origin: Point
}

/**
 * What the shared WebDriver code needs from a client — WebdriverIO,
 * selenium-webdriver under Nightwatch — and nothing more: running a script in a
 * document, and crossing into a frame. `S` is the client's site, `E` its element.
 */
export interface WebDriverLike<S extends WebDriverSite, E> {
  /** The top-level document. */
  top(): S
  /**
   * Runs `pageScript` in the site's document with these arguments and returns
   * its reply. Under WebDriver Classic, `classicScript()` is the body to send.
   */
  run(site: S, args: PageScriptArgs): Promise<unknown>
  /** Evaluates the resolver's injectable source in the site's document. */
  inject(site: S, source: string): Promise<void>
  /** An element the page script returned, as the client's own element. */
  element(site: S, ref: ElementRef): Promise<E>
  /**
   * Enters `iframe`, an element of `site`'s document, and returns the site for
   * the frame's document, at `origin` in the top-level viewport.
   */
  enterFrame(site: S, iframe: E, origin: Point): Promise<S>
  /**
   * Undoes what entering frames changed in the session — under Classic, switches
   * back to the top-level document. Called once after a walk that entered any.
   */
  leaveFrames(): Promise<void>
  /** Hears the top-level document's URL, which every call there brings back. */
  sawUrl?(url: string): void
}

let classic: string | undefined

/**
 * The page script as a classic Execute Script body, which awaits the promise
 * the script returns.
 */
export function classicScript(): string {
  if (classic === undefined) classic = `return (${pageScript.toString()}).apply(null, arguments)`
  return classic
}

/**
 * Runs one operation of the shared resolver in a document, injecting the
 * resolver first if the document does not have it yet.
 *
 * The presence check rides along with the call itself, so a document that
 * already has the resolver pays one round-trip, not two. Injecting happens once
 * per document: navigation replaces the window, and the resolver with it.
 */
export async function callPage<S extends WebDriverSite, E>(
  driver: WebDriverLike<S, E>,
  site: S,
  op: PageOp,
  scope: readonly Selector[],
  selector: Selector,
  timeout: number,
  arg: string | null = null,
): Promise<unknown> {
  checkTestIds(scope, selector)
  const args: PageScriptArgs = [
    PAGE_API_GLOBAL,
    op,
    scope.map(encodeSelector),
    encodeSelector(selector),
    // The page cannot see this process's configure(), so the settings travel.
    { testIdAttribute: getConfig().testIdAttribute, timeout },
    arg,
  ]
  const ask = async () => (await driver.run(site, args)) as PageReply
  let reply = await ask()
  if (reply.kind === 'missing') {
    await driver.inject(site, injectSource())
    reply = await ask()
  }
  if (reply.kind === 'missing') {
    throw new Error('harnessed: the resolver could not be injected into the page.')
  }
  // A strict violation comes back as core's own class, as under every driver.
  if (reply.kind === 'error') throw reviveStrictViolation(new PageError(reply.name, reply.message))
  if (site.top) driver.sawUrl?.(reply.url)
  return reply.value
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

/** What the page reports about an iframe a walk is about to enter. */
export interface FrameInfo {
  /** Whether the iframe is visible by layout in its own document. */
  readonly visible: boolean
}

export interface WalkOptions<E> {
  /** Wait for each frame link, or answer at once by throwing FrameAbsent. */
  waiting: boolean
  /** The budget for every hop and the operation together. */
  timeout: number
  /** Called with each iframe element, from its own document, before entering it. */
  onFrame?: (iframe: E, info: FrameInfo) => Promise<void>
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
 * Whatever entering changed in the session is undone afterwards, whatever
 * happened (`leaveFrames`).
 */
export async function walk<S extends WebDriverSite, E, T>(
  driver: WebDriverLike<S, E>,
  scope: readonly Selector[],
  options: WalkOptions<E>,
  operation: (site: S, scope: Selector[], remaining: () => number) => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + options.timeout
  const remaining = () => Math.max(0, deadline - Date.now())
  const { hops, rest } = splitAtFrames(scope)
  let site = driver.top()
  let entered = false
  try {
    for (const hop of hops) {
      const op = options.waiting ? 'frame' : 'frameNow'
      const found = (await callPage(driver, site, op, hop.scope, hop.link, remaining())) as {
        element: ElementRef | null
        origin: Point
        visible: boolean
      }
      if (found.element === null) throw new FrameAbsent()
      const iframe = await driver.element(site, found.element)
      await options.onFrame?.(iframe, { visible: found.visible })
      // The frame's document starts where its content box does, in the document around it.
      const origin = { x: site.origin.x + found.origin.x, y: site.origin.y + found.origin.y }
      site = await driver.enterFrame(site, iframe, origin)
      entered = true
    }
    return await operation(site, rest, remaining)
  } finally {
    if (entered) await driver.leaveFrames()
  }
}
