import { describeScope, describeSelector, getConfig, timeoutFor } from '@harnessed-ts/core'
import type { Selector } from '@harnessed-ts/core'
import { encodeSelector, injectSource, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'
import type { PageApi, PageApiOptions, WireSelector } from '@harnessed-ts/resolve/inject'
import type { ElementHandle, Frame, Page } from 'puppeteer'

/**
 * A frame link that cannot be entered — a wiring mistake, never "not rendered
 * yet", so no wait retries it. The Node-side counterpart of the resolver's own
 * `FrameEntryError`: this driver enters frames itself, so the page never sees
 * a frame link to refuse.
 */
export class FrameEntryError extends Error {
  override name = 'FrameEntryError'
}

/**
 * Where the last stretch of a scope chain is resolved: the frame it lives in,
 * the links left to walk inside that frame, and the iframes crossed to get there.
 */
export interface Entered {
  readonly frame: Frame
  /** The links of the scope chain that lie inside `frame`. */
  readonly scope: readonly Selector[]
  /** The links crossed to reach `frame`, so a message can name the whole chain. */
  readonly prefix: readonly Selector[]
  /** The iframe elements crossed, outermost first. A hidden frame hides its content. */
  readonly hosts: readonly ElementHandle<Element>[]
}

/** How a lookup treats a target that is not on screen yet. */
export type Lookup = 'wait' | 'now'

type ApiMethod = 'one' | 'oneNow'

/** How long a lookup waits before asking a document that is mid-navigation again. */
export const POLL_MS = 50

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

function apiOptions(timeout: number): PageApiOptions {
  // The page cannot see this process's configure(), so the config travels with
  // every call.
  return { testIdAttribute: getConfig().testIdAttribute, timeout }
}

/** Navigation replaces the document, and the injected resolver goes with it. */
function isMissingApi(error: unknown): boolean {
  return error instanceof Error && error.message.includes(`${PAGE_API_GLOBAL} is not installed`)
}

/**
 * What Puppeteer reports when the document a call ran in was torn down under
 * it — a full-page navigation, or a frame whose parent navigated. Never an
 * answer about the page: the next document may well have the target.
 */
const NAVIGATION_ERRORS = [
  'Execution context was destroyed',
  'Cannot find context with specified id',
  'Execution context is not available in detached frame',
  'Attempted to use detached Frame',
]

export function isNavigationError(error: unknown): boolean {
  return (
    error instanceof Error && NAVIGATION_ERRORS.some(message => error.message.includes(message))
  )
}

/**
 * Whether the resolver answered "nothing there" after waiting: Testing
 * Library's own wording when a waited-for query finds nothing. A protocol or
 * navigation error is not that answer, and must not be read as absence.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Unable to find')
}

/**
 * Whether the resolver refused a lookup by its own rules — nothing there, an
 * ambiguous match, an index out of range — as opposed to the connection to
 * the page failing.
 */
export function isResolverOutcome(error: unknown): boolean {
  if (error instanceof FrameEntryError) return false
  return isNotFound(error) || (error instanceof Error && error.message.startsWith('harnessed: '))
}

/**
 * Runs a call against the injected resolver until `timeout` runs out, handing
 * it what is left of that budget.
 *
 * The resolver is injected when the frame's current document has none.
 * Checking inside the call rather than before it keeps the common case to a
 * single round-trip, and cannot be raced by a navigation landing between a
 * check and the call. A call that a navigation tore down is asked again of the
 * next document: a lookup that spans a navigation is waiting for that page.
 */
async function withApi<T>(
  frame: Frame,
  timeout: number | undefined,
  call: (options: PageApiOptions) => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + timeoutFor(timeout)
  let injected = false
  for (;;) {
    try {
      return await call(apiOptions(Math.max(0, deadline - Date.now())))
    } catch (error) {
      const expired = Date.now() >= deadline
      if (isMissingApi(error) && !(expired && injected)) {
        injected = true
        try {
          await frame.evaluate(injectSource())
        } catch (injectError) {
          if (!isNavigationError(injectError) || frame.detached) throw injectError
        }
        continue
      }
      // A detached frame never comes back; the caller re-enters from the top.
      if (!isNavigationError(error) || frame.detached || expired) throw error
      await sleep(POLL_MS)
    }
  }
}

/**
 * Restates a resolver error for a lookup that ran inside a frame. The page only
 * saw the links inside its own document, so its messages name a partial chain;
 * prefixing the links that led there makes them read as they do under the dom
 * driver, which walks the whole chain in one realm.
 */
function restate(
  error: unknown,
  prefix: readonly Selector[],
  scope: readonly Selector[],
  selector: Selector,
): unknown {
  if (prefix.length === 0 || !(error instanceof Error)) return error
  if (!error.message.startsWith('harnessed: ')) return error
  // Every path the page describes starts at the first link inside the frame.
  const head = scope[0] ?? selector
  // A replacer function, so a `$` in a selector is not read as a replacement pattern.
  const restated = describeScope(prefix, head)
  error.message = error.message.replace(describeSelector(head), () => restated)
  return error
}

/** The page side of a single-target lookup. Serialised into the page: no closures. */
function pageOne(
  name: string,
  method: ApiMethod,
  scope: WireSelector[],
  selector: WireSelector,
  options: PageApiOptions,
): Promise<Element | null> | Element | null {
  const api = (globalThis as unknown as Record<string, PageApi | undefined>)[name]
  if (api === undefined) throw new Error(`${name} is not installed`)
  return api[method](null, scope, selector, options)
}

function pageCount(
  name: string,
  scope: WireSelector[],
  selector: WireSelector,
  options: PageApiOptions,
): Promise<number> {
  const api = (globalThis as unknown as Record<string, PageApi | undefined>)[name]
  if (api === undefined) throw new Error(`${name} is not installed`)
  return api.count(null, scope, selector, options)
}

/** The page side of a visibility check. Serialised into the page: no closures. */
function pageVisible(element: Element, name: string): boolean {
  const api = (globalThis as unknown as Record<string, PageApi | undefined>)[name]
  if (api === undefined) throw new Error(`${name} is not installed`)
  return api.visible(element)
}

/**
 * Whether an element is visible by the shared layout rule, judged within its
 * own document — the same rule the in-page drivers use, so `display: contents`
 * reads from what it contains rather than from a box it does not have. The
 * element was resolved in its frame, so the resolver is already there.
 */
export async function visibleInOwnDocument(element: ElementHandle<Element>): Promise<boolean> {
  return element.evaluate(pageVisible, PAGE_API_GLOBAL)
}

/**
 * The single node a strict operation acts on, inside one frame. `wait` waits for
 * it to appear; `now` answers `null` when it is not there yet. Both reject at
 * once on ambiguity and an out-of-range index — the resolver's rules, not ours.
 */
export async function oneIn(
  frame: Frame,
  prefix: readonly Selector[],
  scope: readonly Selector[],
  selector: Selector,
  lookup: Lookup,
  timeout?: number,
): Promise<ElementHandle<Element> | null> {
  const method: ApiMethod = lookup === 'wait' ? 'one' : 'oneNow'
  let handle
  try {
    handle = await withApi(frame, timeout, options =>
      frame.evaluateHandle(
        pageOne,
        PAGE_API_GLOBAL,
        method,
        scope.map(encodeSelector),
        encodeSelector(selector),
        options,
      ),
    )
  } catch (error) {
    throw restate(error, prefix, scope, selector)
  }
  const element = handle.asElement()
  if (element === null) await handle.dispose()
  return element as ElementHandle<Element> | null
}

/** How many nodes match inside one frame. The scope waits; the count does not. */
export async function countIn(
  frame: Frame,
  prefix: readonly Selector[],
  scope: readonly Selector[],
  selector: Selector,
  timeout?: number,
): Promise<number> {
  try {
    return await withApi(frame, timeout, options =>
      frame.evaluate(
        pageCount,
        PAGE_API_GLOBAL,
        scope.map(encodeSelector),
        encodeSelector(selector),
        options,
      ),
    )
  } catch (error) {
    throw restate(error, prefix, scope, selector)
  }
}

/**
 * Walks the scope chain across every `frame()` link, returning the frame the
 * rest of the chain lives in — or `null` under `now` when a frame is not on
 * screen yet.
 *
 * Each iframe is resolved in the frame around it and entered with
 * `contentFrame()`, and the resolver is injected into each document reached.
 * That is what lets this driver enter cross-origin frames, which the in-page
 * resolver alone cannot: a cross-origin document is unreachable from script in
 * the page, but not from the browser.
 */
export async function enterFrames(
  page: Page,
  scope: readonly Selector[],
  lookup: Lookup,
  timeout?: number,
): Promise<Entered | null> {
  let frame = page.mainFrame()
  let start = 0
  const hosts: ElementHandle<Element>[] = []
  try {
    for (const [index, link] of scope.entries()) {
      if (link.frame !== true) continue
      const path = scope.slice(0, index)
      const host = await oneIn(
        frame,
        scope.slice(0, start),
        scope.slice(start, index),
        link,
        lookup,
        timeout,
      )
      if (host === null) {
        await disposeAll(hosts)
        return null
      }
      hosts.push(host)
      const tag = await host.evaluate(element => element.localName)
      if (tag !== 'iframe') {
        // The same refusal, worded the same way, as the resolver's own.
        throw new FrameEntryError(
          `harnessed: ${describeScope(path, link)} is marked as a frame but is a <${tag}>, not an <iframe>.`,
        )
      }
      const inner = await host.contentFrame()
      if (inner === null) {
        throw new FrameEntryError(
          `harnessed: ${describeScope(path, link)} has no document to enter: the <iframe> is not attached to a frame.`,
        )
      }
      frame = inner
      start = index + 1
    }
  } catch (error) {
    await disposeAll(hosts)
    throw error
  }
  return { frame, scope: scope.slice(start), prefix: scope.slice(0, start), hosts }
}

export async function disposeAll(handles: readonly ElementHandle<Element>[]): Promise<void> {
  // A handle in a document that navigated away is already gone; that is fine.
  await Promise.all(handles.map(handle => handle.dispose().catch(() => undefined)))
}
