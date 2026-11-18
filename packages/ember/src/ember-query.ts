import { click, fillIn, getRootElement, settled } from '@ember/test-helpers'
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
import {
  boundingBoxOf,
  countAll,
  fileInputOf,
  FrameEntryError,
  isVisibleInLayout,
  resolveAll,
  resolveOne,
} from '@harnessed-ts/resolve'
import { waitFor as waitForCondition } from '@testing-library/dom'
import { EMBER_DRIVER } from './driver-id'
import type { EmberEnv } from './env'

/** The element each document's pointer is over, so hovering B after A leaves A first. */
const hovered = new WeakMap<Document, Element>()

const POINTER: PointerEventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
}

/**
 * test-helpers' click, with the pointerdown and pointerup a browser sends just before
 * its mousedown and mouseup: test-helpers sends no pointer events, so a handler on
 * pointerup never ran. Not user-event's click: its setup patches the document for
 * good, and an Ember test run shares one document.
 */
async function clickLikeABrowser(element: Element): Promise<void> {
  const document = element.ownerDocument
  const precede = (mouse: string, pointer: string) => {
    const listener = (event: Event) => {
      if (event.target === element) element.dispatchEvent(new PointerEvent(pointer, POINTER))
    }
    document.addEventListener(mouse, listener, { capture: true })
    return () => document.removeEventListener(mouse, listener, { capture: true })
  }
  const stops = [precede('mousedown', 'pointerdown'), precede('mouseup', 'pointerup')]
  try {
    await click(element)
  } finally {
    for (const stop of stops) stop()
  }
}

/** `element` and its ancestors up to, not including, the first one that contains `other`. */
function chainUntil(element: Element | undefined, other: Element | undefined): Element[] {
  const chain: Element[] = []
  for (
    let node = element ?? null;
    node !== null && !node.contains(other ?? null);
    node = node.parentElement
  ) {
    chain.push(node)
  }
  return chain
}

/**
 * The events a browser sends when the pointer moves from the last hovered element
 * onto `element`: out and leave on what it leaves, over and enter on what it enters.
 */
function hoverLikeABrowser(element: Element): void {
  const document = element.ownerDocument
  const last = hovered.get(document)
  hovered.set(document, element)
  if (last === element) return
  // A previous test's element is gone: there is nothing left to leave.
  const from = last?.isConnected ? last : undefined
  const fire = (target: Element, pointer: string, mouse: string, bubbles: boolean) => {
    target.dispatchEvent(new PointerEvent(pointer, { ...POINTER, bubbles }))
    target.dispatchEvent(new MouseEvent(mouse, { bubbles, cancelable: bubbles, composed: true }))
  }
  if (from !== undefined) {
    fire(from, 'pointerout', 'mouseout', true)
    for (const node of chainUntil(from, element)) fire(node, 'pointerleave', 'mouseleave', false)
  }
  fire(element, 'pointerover', 'mouseover', true)
  for (const node of chainUntil(element, from).reverse())
    fire(node, 'pointerenter', 'mouseenter', false)
  fire(element, 'pointermove', 'mousemove', true)
}

type Editable = HTMLInputElement | HTMLTextAreaElement

/** A field a typed key changes: a text-like input or a textarea, not read-only or disabled. */
function editableOf(target: Element): Editable | undefined {
  // Tag names, not instanceof: an element rendered into a frame can carry the
  // parent window's prototypes.
  const isField =
    target.localName === 'textarea' ||
    (target.localName === 'input' &&
      ![
        'button',
        'checkbox',
        'color',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'submit',
      ].includes((target as HTMLInputElement).type))
  if (!isField) return undefined
  const field = target as Editable
  return field.readOnly || field.disabled ? undefined : field
}

/**
 * The caret, or the end of the value where the input has no selection API
 * (email, number): reading `selectionStart` there gives null.
 */
function selectionOf(field: Editable): [number, number] {
  const start = field.selectionStart
  const end = field.selectionEnd
  return start === null || end === null ? [field.value.length, field.value.length] : [start, end]
}

/** Writes the field's new value and caret, then fires `input` as a browser does. */
function edit(
  field: Editable,
  value: string,
  caret: number,
  inputType: string,
  data: string | null,
): void {
  field.value = value
  if (field.selectionStart !== null) field.setSelectionRange(caret, caret)
  field.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType, data }))
}

const TABBABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])'

/**
 * Tab: focus the next element in document order that Tab reaches (the previous one
 * with Shift), from wherever focus is once keydown's handlers have run.
 * shortcut: ignores positive tabindex order; add it when a harness needs one.
 */
function tabFrom(target: Element, backward: boolean): void {
  const document = target.ownerDocument
  const reachable = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    element =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled, [inert] *, input[type="hidden"]') &&
      element.getClientRects().length > 0,
  )
  const next = backward
    ? reachable
        .filter(
          element =>
            target.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING &&
            !element.contains(target),
        )
        .at(-1)
    : reachable.find(
        element =>
          target.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING &&
          !target.contains(element),
      )
  if (next === undefined) (document.activeElement as HTMLElement | null)?.blur()
  else next.focus()
}

/**
 * What a browser does when nothing prevents a key: move focus with Tab, type
 * the key, delete with it, or submit with Enter.
 * shortcut: no Space or Enter clicks; add them when a harness presses one.
 */
function keyDefault(target: Element, key: string, shift: boolean): void {
  if (key === 'Tab') {
    tabFrom(target.ownerDocument.activeElement ?? target, shift)
    return
  }
  const field = editableOf(target)
  if (field === undefined) return
  const [start, end] = selectionOf(field)
  const value = field.value
  if (key.length === 1) {
    if (field.maxLength >= 0 && value.length - (end - start) + 1 > field.maxLength) return
    edit(field, value.slice(0, start) + key + value.slice(end), start + 1, 'insertText', key)
  } else if (key === 'Backspace') {
    const from = start === end ? Math.max(0, start - 1) : start
    if (from === end) return
    edit(field, value.slice(0, from) + value.slice(end), from, 'deleteContentBackward', null)
  } else if (key === 'Delete') {
    const to = start === end ? Math.min(value.length, end + 1) : end
    if (start === to) return
    edit(field, value.slice(0, start) + value.slice(to), start, 'deleteContentForward', null)
  } else if (key === 'Enter') {
    if (field.localName === 'textarea') {
      edit(
        field,
        value.slice(0, start) + '\n' + value.slice(end),
        start + 1,
        'insertLineBreak',
        null,
      )
    } else {
      // Implicit submission: the form's submit button decides, as in a browser.
      field.form?.requestSubmit()
    }
  }
}

/** The modifier flag each held key sets on the events sent while it is down. */
const MODIFIERS: Record<string, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'> = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Meta: 'metaKey',
  Shift: 'shiftKey',
}

/**
 * keydown to the focused element, the browser's default action unless a handler
 * prevented it, then keyup to whatever has focus after that, as a browser sends a key.
 * A Playwright chord (`Shift+ArrowDown`) holds its modifiers down around the last key,
 * and the events sent while they are down carry their flags.
 */
function pressLikeABrowser(element: Element, chord: string): void {
  const document = element.ownerDocument
  const focused = () => document.activeElement ?? document.body
  // `+` alone, or a trailing `++`, is the plus key itself rather than a separator.
  const keys = (chord.length > 1 ? chord.split(/\+(?!$)/) : [chord]).map(key =>
    key === 'ControlOrMeta' ? controlOrMeta(document) : key,
  )
  const flags: KeyboardEventInit = {}
  const send = (type: 'keydown' | 'keyup', key: string) =>
    focused().dispatchEvent(
      new KeyboardEvent(type, { key, bubbles: true, cancelable: true, composed: true, ...flags }),
    )
  for (const [index, key] of keys.entries()) {
    const modifier = MODIFIERS[key]
    if (index < keys.length - 1 && modifier !== undefined) {
      flags[modifier] = true
      send('keydown', key)
      continue
    }
    const target = focused()
    // A shortcut (Control, Meta or Alt held) does not type or delete.
    const shortcut = flags.ctrlKey || flags.metaKey || flags.altKey
    if (send('keydown', key) && !shortcut) keyDefault(target, key, flags.shiftKey === true)
    send('keyup', key)
  }
  for (const key of keys.slice(0, -1).reverse()) {
    const modifier = MODIFIERS[key]
    if (modifier === undefined) continue
    flags[modifier] = false
    send('keyup', key)
  }
}

/** Playwright's `ControlOrMeta`: Meta on macOS, Control elsewhere. */
function controlOrMeta(document: Document): 'Control' | 'Meta' {
  return /Mac/.test(document.defaultView?.navigator.platform ?? '') ? 'Meta' : 'Control'
}

/** user-event's `accept` rule: case-insensitive, jpg and jpeg alike, `image/*` wildcards. */
function accepts(accept: string, file: File): boolean {
  if (accept === '') return true
  const normalize = (nameOrType: string) =>
    nameOrType.toLowerCase().replace(/(\.|\/)jpg\b/g, '$1jpeg')
  return normalize(accept)
    .trim()
    .split(/\s*,\s*/)
    .some(token => {
      if (token.startsWith('.')) return normalize(file.name).endsWith(token)
      if (['audio/*', 'image/*', 'video/*'].includes(token)) {
        return normalize(file.type).startsWith(token.slice(0, -1))
      }
      return normalize(file.type) === token
    })
}

/**
 * Testing Library's `waitFor` retries every throw, but a frame that cannot be
 * entered never becomes enterable, and several matches never become one — so
 * either ends the wait at once. Not test-helpers' `waitUntil`: its callback is
 * synchronous, and every check here resolves through the async resolver.
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

/**
 * Ember driver. Resolution is the shared resolver, so it agrees with every other
 * in-page driver. Every interaction resolves only once the app has settled —
 * runloop drained, rendering done, test waiters clear.
 *
 * Clicks and fills go through `@ember/test-helpers`, the way an Ember test
 * dispatches them; a click adds the pointer events test-helpers leaves out. Keys,
 * hover and selects are dispatched here: test-helpers' versions skip a browser's
 * default actions (a pressed key never reaches the value), refuse elements a
 * browser would accept (a disabled control, a non-focusable dialog), and match
 * options by value only. Nothing goes through user-event: its setup patches the
 * document for good, and an Ember test run shares one document, so a number input
 * in a later test read "42.50" back as "42.5".
 *
 * Each helper is handed the resolved element, never a selector string, so
 * strictness and scope stay this library's rather than `querySelector`'s.
 */
export class EmberQuery extends Query {
  constructor(
    private readonly root: Element | undefined,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new EmberQuery(this.root, this.scope, selector)
  }

  /** Read per call: the root element belongs to the current test, not the env. */
  protected container(): HTMLElement {
    return (this.root ?? getRootElement()) as HTMLElement
  }

  protected element(options?: WaitOptions): Promise<HTMLElement> {
    return resolveOne(this.container(), this.scope, this.selector, options?.timeout)
  }

  /** Every match in one pass, each bound to its node. See `DomQuery.all`. */
  override async all(): Promise<Query[]> {
    return (await resolveAll(this.container(), this.scope, this.selector)).map(
      (element, index) =>
        new BoundEmberQuery(this.root, this.scope, withNth(this.selector, index), element),
    )
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await clickLikeABrowser(await this.element(options))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    // fillIn replaces the value and fires input and change: Playwright's fill.
    await fillIn(await this.element(options), value)
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await fillIn(await this.element(options), '')
  }

  override async check(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if (!(element as HTMLInputElement).checked) await clickLikeABrowser(element)
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if ((element as HTMLInputElement).checked) await clickLikeABrowser(element)
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const element = (await this.element(options)) as HTMLSelectElement
    // Each value matches an option's value or its label. A miss throws before
    // anything changes; the new selection replaces the old one, as in Playwright.
    const chosen = (Array.isArray(value) ? value : [value]).map(wanted => {
      const option = [...element.options].find(
        o => o.value === wanted || o.label === wanted || o.text.trim() === wanted,
      )
      if (option === undefined) throw new Error(`No option matches "${wanted}"`)
      return option
    })
    for (const option of element.options) option.selected = chosen.includes(option)
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    await settled()
  }

  override async hover(options?: WaitOptions): Promise<void> {
    hoverLikeABrowser(await this.element(options))
    await settled()
  }

  override async focus(options?: WaitOptions): Promise<void> {
    // The DOM method: a no-op on an element that cannot take focus, where
    // test-helpers' focus() throws.
    ;(await this.element(options)).focus()
    await settled()
  }

  override async blur(options?: WaitOptions): Promise<void> {
    ;(await this.element(options)).blur()
    await settled()
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    // Focus, then press: the key goes to the focused element, as in a browser.
    // On an element that cannot take focus, that is whatever already had it.
    element.focus()
    pressLikeABrowser(element, key)
    await settled()
  }

  /**
   * What user-event's upload does — skip a disabled input, drop files `accept`
   * refuses, fire nothing when the selection is unchanged — without user-event:
   * its setup patches the document for good, and an Ember run shares one
   * document, so a number input in a later test read "42.50" back as "42.5".
   */
  override async upload(files: File | File[], options?: WaitOptions): Promise<void> {
    const list = Array.isArray(files) ? files : [files]
    const input = fileInputOf(await this.element(options))
    checkFileTarget(input, list.length, this.scope, this.selector)
    if (input.matches(':disabled')) return
    const chosen = list.filter(file => accepts(input.accept, file))
    const current = [...(input.files ?? [])]
    if (chosen.length === current.length && chosen.every((file, i) => file === current[i])) return
    // The input's own window: a DataTransfer from another realm is refused.
    const transfer = new input.ownerDocument.defaultView!.DataTransfer()
    for (const file of chosen) transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await settled()
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
      // A real browser, so a real layout check — Playwright's rule, not jsdom's
      // computed-style walk.
      return isVisibleInLayout(await this.element(options), this.container().ownerDocument)
    } catch (error) {
      // Several matches is ambiguity, not invisibility: answering false would
      // claim that nodes on screen are not.
      if (error instanceof FrameEntryError || error instanceof StrictModeViolation) throw error
      // Not on screen at all, or an index past the last match.
      return false
    }
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    const element = await this.element(options)
    // The property, and an ancestor `fieldset[disabled]`: see `DomQuery.isEnabled`.
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
    return [...(element.selectedOptions ?? [])].map(option => option.value)
  }

  override async boundingBox(options?: WaitOptions): Promise<BoundingBox> {
    return boundingBoxOf(await this.element(options), this.container().ownerDocument)
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    if (state === 'visible') {
      await waitUntil(async () => {
        if (!(await this.isVisible({ timeout }))) throw new Error('not visible yet')
      }, timeout)
    } else {
      await waitUntil(async () => {
        if ((await this.count()) !== 0 && (await this.isVisible({ timeout }))) {
          throw new Error('still visible')
        }
      }, timeout)
    }
    // Whatever made it appear or go may have scheduled more work; hand back a
    // settled app, as every interaction does.
    await settled()
  }

  override async count(): Promise<number> {
    return countAll(this.container(), this.scope, this.selector)
  }
}

/** A query pinned to a node `all()` already found. See `BoundDomQuery`. */
class BoundEmberQuery extends EmberQuery {
  constructor(
    root: Element | undefined,
    scope: readonly Selector[],
    selector: Selector,
    private readonly bound: HTMLElement,
  ) {
    super(root, scope, selector)
  }

  protected override async element(options?: WaitOptions): Promise<HTMLElement> {
    if (this.bound.isConnected) return this.bound
    return super.element(options)
  }
}

registerDriver(EMBER_DRIVER, (env: EnvConfig, scope, selector) => {
  return new EmberQuery((env as EmberEnv).root, scope, selector)
})
