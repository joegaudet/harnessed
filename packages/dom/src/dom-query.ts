import { Query, registerDriver } from '@harnessed-ts/core'
import type { BoundingBox, EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import {
  checkedFrom,
  checkFileTarget,
  enabledFrom,
  nth as withNth,
  StrictModeViolation,
  timeoutFor,
} from '@harnessed-ts/core'
import { waitFor as waitForCondition } from '@testing-library/dom'
import type { UserEvent } from '@testing-library/user-event'
import { DOM_DRIVER } from './driver-id'
import type { DomEnv } from './env'
import {
  boundingBoxOf,
  countAll,
  fileInputOf,
  FrameEntryError,
  resolveAll,
  resolveOne,
} from '@harnessed-ts/resolve'

/**
 * The values of a select's selected options. Read off `options` rather than
 * `selectedOptions`: they mean the same, but happy-dom's `selectedOptions` can
 * go stale after a deselect.
 */
function selectedValues(element: HTMLSelectElement): string[] {
  return [...element.options].filter(option => option.selected).map(option => option.value)
}

/** Playwright key names such as `Enter` map onto user-event's `{Enter}` syntax. */
function toKeyboardInput(key: string): string {
  return key.length === 1 ? key : `{${key}}`
}

/**
 * The iframes, outermost first, that lead from `home` to `doc`. `frameElement`
 * says it directly where the DOM implements it (browsers, jsdom); happy-dom
 * leaves it unset, so otherwise the frames under `home` are searched.
 */
function framePath(home: Document, doc: Document): HTMLIFrameElement[] {
  const path: HTMLIFrameElement[] = []
  let current: Document = doc
  while (current !== home) {
    const frame = current.defaultView?.frameElement as HTMLIFrameElement | null | undefined
    if (frame === null || frame === undefined) return searchFrames(home, doc) ?? []
    path.unshift(frame)
    current = frame.ownerDocument
  }
  return path
}

function searchFrames(from: Document, doc: Document): HTMLIFrameElement[] | undefined {
  for (const frame of from.querySelectorAll('iframe')) {
    const inner = frame.contentDocument
    if (inner === null) continue
    if (inner === doc) return [frame]
    const deeper = searchFrames(inner, doc)
    if (deeper !== undefined) return [frame, ...deeper]
  }
  return undefined
}

/** `home` is the env's own document: the walk crosses only frames the scope entered. */
function isVisibleByStyle(element: HTMLElement, home: Document): boolean {
  // jsdom computes no layout, so offsetParent is always null and getBoundingClientRect
  // is always zero. Computed style is the only signal available here.
  let current: HTMLElement | null = element
  while (current !== null) {
    // The node's own window: inside a frame, that is the frame's.
    const view: Window = current.ownerDocument.defaultView ?? window
    const style = view.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false
    }
    if (current.hasAttribute('hidden')) return false
    // At a frame's root, carry on from the iframe: a hidden frame hides its content.
    current =
      current.parentElement ??
      (current.ownerDocument === home
        ? null
        : (framePath(home, current.ownerDocument).at(-1) ?? null))
  }
  return true
}

/**
 * Testing Library's `waitFor` retries every throw, but a frame that cannot be
 * entered never becomes enterable, and several matches never become one — so
 * either ends the wait at once.
 */
async function waitUntil(condition: () => Promise<void>, timeout: number): Promise<void> {
  let refused: FrameEntryError | StrictModeViolation | undefined
  await waitForCondition(
    async () => {
      try {
        await condition()
      } catch (error) {
        if (!(error instanceof FrameEntryError || error instanceof StrictModeViolation)) {
          throw error
        }
        refused = error
      }
    },
    { timeout },
  )
  if (refused !== undefined) throw refused
}

/** Testing Library driver. Framework-agnostic: it knows about the DOM, not React. */
export class DomQuery extends Query {
  constructor(
    private readonly user: UserEvent,
    private readonly container: HTMLElement,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new DomQuery(this.user, this.container, this.scope, selector)
  }

  protected element(options?: WaitOptions): Promise<HTMLElement> {
    return resolveOne(this.container, this.scope, this.selector, options?.timeout)
  }

  /**
   * The element an interaction acts on. Inside a frame, the frames leading to it
   * are focused first, as a real click into the frame would: user-event types
   * into its document's active element, which only reaches into a frame through
   * the focused `<iframe>`, and happy-dom does not focus the frame by itself.
   */
  protected async target(options?: WaitOptions): Promise<HTMLElement> {
    const element = await this.element(options)
    const home = this.container.ownerDocument
    if (element.ownerDocument !== home) {
      for (const frame of framePath(home, element.ownerDocument)) {
        if (frame.ownerDocument.activeElement !== frame) frame.focus()
      }
    }
    return element
  }

  /**
   * Every match, resolved in one pass: the scope chain is walked once and the
   * siblings scanned once, where the inherited default re-does both per element —
   * O(N²) in Testing Library queries for a list of N.
   *
   * Each result is bound to its already-resolved node. A callback that mutates
   * the page can detach those nodes, so a bound query falls back to ordinary
   * index resolution the moment its node leaves the document.
   */
  override async all(): Promise<Query[]> {
    return (await resolveAll(this.container, this.scope, this.selector)).map(
      (element, index) =>
        new BoundDomQuery(
          this.user,
          this.container,
          this.scope,
          withNth(this.selector, index),
          element,
        ),
    )
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.user.click(await this.target(options))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    const element = await this.target(options)
    await this.user.clear(element)
    // user-event throws on an empty string, and clearing is the whole intent
    // anyway — which is also what Playwright's fill('') does.
    if (value !== '') await this.user.type(element, value)
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.user.clear(await this.target(options))
  }

  override async check(options?: WaitOptions): Promise<void> {
    const element = await this.target(options)
    if (!(element as HTMLInputElement).checked) await this.user.click(element)
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    const element = await this.target(options)
    if ((element as HTMLInputElement).checked) await this.user.click(element)
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const element = (await this.target(options)) as HTMLSelectElement
    // user-event adds to a multi-select's existing selection; Playwright replaces
    // it. Replacing is the useful semantic and the one the shared API promises,
    // so clear first.
    if (element.multiple) {
      const selected = selectedValues(element)
      if (selected.length > 0) await this.user.deselectOptions(element, selected)
    }
    await this.user.selectOptions(element, value)
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.user.hover(await this.target(options))
  }

  override async focus(options?: WaitOptions): Promise<void> {
    ;(await this.target(options)).focus()
  }

  override async blur(options?: WaitOptions): Promise<void> {
    ;(await this.target(options)).blur()
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    const element = await this.target(options)
    element.focus()
    await this.user.keyboard(toKeyboardInput(key))
  }

  override async upload(files: File | File[], options?: WaitOptions): Promise<void> {
    const list = Array.isArray(files) ? files : [files]
    const input = fileInputOf(await this.target(options))
    checkFileTarget(input, list.length, this.scope, this.selector)
    await this.user.upload(input, list)
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    return ((await this.element(options)).textContent ?? '').trim()
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    const element = await this.element(options)
    return (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value ?? ''
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return (await this.element(options)).getAttribute(name)
  }

  override async isVisible(options?: WaitOptions): Promise<boolean> {
    try {
      return isVisibleByStyle(await this.element(options), this.container.ownerDocument)
    } catch (error) {
      // Several matches is ambiguity, not invisibility: answering false would
      // claim that nodes on screen are not.
      if (error instanceof FrameEntryError || error instanceof StrictModeViolation) throw error
      // Not on screen at all, or an index past the last match. Prefer isAbsent()
      // to ask this — it answers without first waiting out the retry timeout.
      return false
    }
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    const element = await this.element(options)
    // `disabled` is inherited from an ancestor fieldset, and the DOM property
    // already accounts for that where the attribute does not. Reading the
    // attribute alone made a control inside `<fieldset disabled>` report enabled
    // here and disabled under Playwright.
    const disabled =
      (element as HTMLInputElement).disabled === true || element.closest(':disabled') !== null
    return enabledFrom(disabled, element.getAttribute('aria-disabled'))
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    const element = await this.element(options)
    return checkedFrom(
      element.getAttribute('aria-checked'),
      Boolean((element as HTMLInputElement).checked),
    )
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    const element = (await this.element(options)) as HTMLSelectElement
    return selectedValues(element)
  }

  /** jsdom computes no layout: every box here is all zeros. */
  override async boundingBox(options?: WaitOptions): Promise<BoundingBox> {
    return boundingBoxOf(await this.element(options), this.container.ownerDocument)
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    if (state === 'visible') {
      await waitUntil(async () => {
        if (!(await this.isVisible({ timeout }))) throw new Error('not visible yet')
      }, timeout)
      return
    }
    await waitUntil(async () => {
      if ((await this.count()) !== 0 && (await this.isVisible({ timeout }))) {
        throw new Error('still visible')
      }
    }, timeout)
  }

  override async count(): Promise<number> {
    return countAll(this.container, this.scope, this.selector)
  }
}

/** A query pinned to a node `all()` already found. See `DomQuery.all`. */
class BoundDomQuery extends DomQuery {
  constructor(
    user: UserEvent,
    container: HTMLElement,
    scope: readonly Selector[],
    selector: Selector,
    private readonly bound: HTMLElement,
  ) {
    super(user, container, scope, selector)
  }

  protected override async element(options?: WaitOptions): Promise<HTMLElement> {
    if (this.bound.isConnected) return this.bound
    // A re-render replaced the node; the selector still carries this query's
    // index, so ordinary resolution finds the replacement.
    return super.element(options)
  }
}

/**
 * Registering on import is what lets `@harnessed-ts/core` stay driver-free: core
 * holds a registry keyed by driver id and never imports a driver itself.
 */
registerDriver(DOM_DRIVER, (env: EnvConfig, scope, selector) => {
  const domEnv = env as DomEnv
  return new DomQuery(domEnv.user, domEnv.container, scope, selector)
})
