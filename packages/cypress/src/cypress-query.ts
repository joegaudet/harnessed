import { Query, registerDriver } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import {
  checkedFrom,
  describeScope,
  enabledFrom,
  nth as withNth,
  timeoutFor,
} from '@harnessed-ts/core'
import {
  countAll,
  FrameEntryError,
  isVisibleInLayout,
  resolveAll,
  resolveOne,
} from '@harnessed-ts/resolve'
import { waitFor as waitForCondition } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { CYPRESS_DRIVER } from './driver-id'
import type { CypressEnv } from './env'
import { realClick, realHover, realInsertText, realPress, requireChromium } from './real-events'

/** Playwright key names such as `Enter` map onto user-event's `{Enter}` syntax. */
function toKeyboardInput(key: string): string {
  return key.length === 1 ? key : `{${key}}`
}

/**
 * One user-event instance per env and AUT document — the dom driver's one
 * `userEvent.setup()` per test, made lazily.
 *
 * It has to be bound to the AUT's document: by default it binds to the spec
 * frame's, which is a different page. Navigation brings a new document, so the
 * binding is renewed when the document changes. And it must not outlive the
 * env: user-event remembers the last element the pointer was over, and in
 * component testing — one document for the whole run — that element may sit in
 * a frame an earlier test unmounted, whose window is gone.
 */
const users = new WeakMap<CypressEnv, { document: Document; user: UserEvent }>()

function userFor(env: CypressEnv): UserEvent {
  const { document } = env
  const bound = users.get(env)
  if (bound !== undefined && bound.document === document) return bound.user
  const user = userEvent.setup({ document })
  users.set(env, { document, user })
  return user
}

/**
 * Testing Library's `waitFor` retries every throw, but a frame that cannot be
 * entered never becomes enterable — so that refusal ends the wait at once.
 */
async function waitUntil(
  condition: () => Promise<void>,
  container: HTMLElement,
  timeout: number,
): Promise<void> {
  let refused: FrameEntryError | undefined
  await waitForCondition(
    async () => {
      try {
        await condition()
      } catch (error) {
        if (!(error instanceof FrameEntryError)) throw error
        refused = error
      }
    },
    // The default container is the spec frame's document, which never changes;
    // watching the AUT's is what lets a mutation end the wait early.
    { container, timeout },
  )
  if (refused !== undefined) throw refused
}

/**
 * Cypress driver. It runs inside the `cy.harness` bridge's promise, in the spec
 * frame, and reaches into the application under test's frame — same-origin, so
 * the shared resolver works on its document directly, exactly as the dom driver
 * does on jsdom's.
 */
export class CypressQuery extends Query {
  constructor(
    protected readonly env: CypressEnv,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new CypressQuery(this.env, this.scope, selector)
  }

  /** Read per query: navigation replaces the document, and with it the body. */
  private get container(): HTMLElement {
    const { document } = this.env
    return document.body ?? document.documentElement
  }

  protected element(options?: WaitOptions): Promise<HTMLElement> {
    return resolveOne(this.container, this.scope, this.selector, options?.timeout)
  }

  /** Keeps the command log telling the story: one entry per harness action. */
  protected log(action: string, detail?: string): void {
    if (!this.env.log) return
    const target = describeScope(this.scope, this.selector)
    Cypress.log({
      name: 'harness',
      message: `**${action}** ${target}${detail === undefined ? '' : ` ${detail}`}`,
      consoleProps: () => ({ action, target, detail }),
    })
  }

  private get user(): UserEvent {
    return userFor(this.env)
  }

  private get real(): boolean {
    if (this.env.realEvents) requireChromium()
    return this.env.realEvents
  }

  /**
   * Every match, resolved in one pass — see `DomQuery.all` for why. Each result is
   * bound to its node and falls back to index resolution once that node leaves
   * the document.
   */
  override async all(): Promise<Query[]> {
    return (await resolveAll(this.container, this.scope, this.selector)).map(
      (element, index) =>
        new BoundCypressQuery(this.env, this.scope, withNth(this.selector, index), element),
    )
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    this.log('click')
    const element = await this.element(options)
    await (this.real ? realClick(element) : this.user.click(element))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    this.log('fill', JSON.stringify(value))
    const element = await this.element(options)
    if (this.real) {
      await realReplace(element, value)
      return
    }
    await this.user.clear(element)
    // user-event throws on an empty string, and clearing is the whole intent
    // anyway — which is also what Playwright's fill('') does.
    if (value !== '') await this.user.type(element, value)
  }

  override async clear(options?: WaitOptions): Promise<void> {
    this.log('clear')
    const element = await this.element(options)
    await (this.real ? realReplace(element, '') : this.user.clear(element))
  }

  override async check(options?: WaitOptions): Promise<void> {
    this.log('check')
    const element = await this.element(options)
    if ((element as HTMLInputElement).checked) return
    await (this.real ? realClick(element) : this.user.click(element))
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    this.log('uncheck')
    const element = await this.element(options)
    if (!(element as HTMLInputElement).checked) return
    await (this.real ? realClick(element) : this.user.click(element))
  }

  /**
   * Through user-event in both modes: a native `<select>` opens a popup the
   * browser draws outside the page, which CDP pointer input cannot operate.
   */
  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    this.log('selectOption', JSON.stringify(value))
    const element = (await this.element(options)) as HTMLSelectElement
    // user-event adds to a multi-select's existing selection; Playwright replaces
    // it. Replacing is the useful semantic and the one the shared API promises,
    // so clear first.
    if (element.multiple) {
      const selected = [...element.selectedOptions].map(option => option.value)
      if (selected.length > 0) await this.user.deselectOptions(element, selected)
    }
    await this.user.selectOptions(element, value)
  }

  override async hover(options?: WaitOptions): Promise<void> {
    this.log('hover')
    const element = await this.element(options)
    await (this.real ? realHover(element) : this.user.hover(element))
  }

  override async focus(options?: WaitOptions): Promise<void> {
    this.log('focus')
    ;(await this.element(options)).focus()
  }

  override async blur(options?: WaitOptions): Promise<void> {
    this.log('blur')
    ;(await this.element(options)).blur()
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    this.log('press', key)
    const element = await this.element(options)
    element.focus()
    await (this.real ? realPress(key) : this.user.keyboard(toKeyboardInput(key)))
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    this.log('text')
    return ((await this.element(options)).textContent ?? '').trim()
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    this.log('inputValue')
    const element = await this.element(options)
    return (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value ?? ''
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    this.log('attribute', name)
    return (await this.element(options)).getAttribute(name)
  }

  override async isVisible(options?: WaitOptions): Promise<boolean> {
    this.log('isVisible')
    return this.visible(options)
  }

  /**
   * A real browser lays the page out, so visibility is a layout question — a
   * box, and not `visibility: hidden` — answered the way Playwright answers it,
   * rather than the dom driver's computed-style walk.
   */
  private async visible(options?: WaitOptions): Promise<boolean> {
    try {
      return isVisibleInLayout(await this.element(options), this.env.document)
    } catch (error) {
      if (error instanceof FrameEntryError) throw error
      // Not on screen at all. Prefer isAbsent() to ask this — it answers without
      // first waiting out the retry timeout.
      return false
    }
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    this.log('isEnabled')
    const element = await this.element(options)
    // The DOM property accounts for an ancestor `<fieldset disabled>` where the
    // attribute does not — see the dom driver.
    const disabled =
      (element as HTMLInputElement).disabled === true || element.closest(':disabled') !== null
    return enabledFrom(disabled, element.getAttribute('aria-disabled'))
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    this.log('isChecked')
    const element = await this.element(options)
    return checkedFrom(
      element.getAttribute('aria-checked'),
      Boolean((element as HTMLInputElement).checked),
    )
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    this.log('selectedOptions')
    const element = (await this.element(options)) as HTMLSelectElement
    return [...(element.selectedOptions ?? [])].map(option => option.value)
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    this.log('waitFor', state)
    const timeout = timeoutFor(options?.timeout)
    const root = this.env.document.documentElement
    if (state === 'visible') {
      await waitUntil(
        async () => {
          if (!(await this.visible({ timeout }))) throw new Error('not visible yet')
        },
        root,
        timeout,
      )
      return
    }
    await waitUntil(
      async () => {
        if ((await this.count()) !== 0 && (await this.visible({ timeout }))) {
          throw new Error('still visible')
        }
      },
      root,
      timeout,
    )
  }

  override async count(): Promise<number> {
    return countAll(this.container, this.scope, this.selector)
  }
}

/**
 * Input types Playwright's `fill()` sets directly rather than types into: their
 * value is not text, so keystrokes into them mean nothing.
 */
const SET_VALUE_TYPES = ['color', 'date', 'time', 'datetime-local', 'month', 'range', 'week']

/**
 * Sets the value and fires the events a person's edit ends with, as Playwright
 * does for these types. The setter is the prototype's, not the element's own:
 * React shadows `value` on the instance to track it, and a write through that
 * shadow would make the `input` event look like no change at all.
 */
function setValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
  if (setter === undefined) input.value = value
  else setter.call(input, value)
  if (input.value !== value) {
    throw new Error(
      `harnessed: "${value}" is not a valid value for an <input type="${input.type}">.`,
    )
  }
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Selects what the field holds and types over it, so the browser fires the
 * trusted input events a person's keystrokes would. Empty means delete. A
 * date, time, colour or range input takes no typing, so its value is set.
 */
async function realReplace(element: HTMLElement, value: string): Promise<void> {
  element.focus()
  // localName, not instanceof: the element belongs to the AUT's realm, not ours.
  const input = element as HTMLInputElement
  if (element.localName === 'input' && SET_VALUE_TYPES.includes(input.type)) {
    setValue(input, value)
    return
  }
  if (element.localName === 'input' || element.localName === 'textarea') {
    ;(element as HTMLInputElement | HTMLTextAreaElement).select()
  } else {
    element.ownerDocument.getSelection()?.selectAllChildren(element)
  }
  await (value === '' ? realPress('Delete') : realInsertText(value))
}

/** A query pinned to a node `all()` already found. See `BoundDomQuery`. */
class BoundCypressQuery extends CypressQuery {
  constructor(
    env: CypressEnv,
    scope: readonly Selector[],
    selector: Selector,
    private readonly bound: HTMLElement,
  ) {
    super(env, scope, selector)
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
registerDriver(CYPRESS_DRIVER, (env: EnvConfig, scope, selector) => {
  return new CypressQuery(env as CypressEnv, scope, selector)
})
