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
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { ANGULAR_DRIVER } from './driver-id'
import type { AngularEnv } from './env'
import { settle } from './stable'

/**
 * One user-event instance per document, kept so pointer state carries between
 * calls: hovering B after A has to leave A first.
 */
const users = new WeakMap<Document, UserEvent>()

function userFor(element: Element): UserEvent {
  const document = element.ownerDocument
  let user = users.get(document)
  if (user === undefined) {
    user = userEvent.setup({ document })
    users.set(document, user)
  }
  return user
}

/** Playwright key names such as `Enter` map onto user-event's `{Enter}` syntax. */
function toKeyboardInput(key: string): string {
  return key.length === 1 ? key : `{${key}}`
}

/**
 * Whether the engine lays pages out. jsdom and happy-dom do not: every box is
 * zero there, so a layout check would call everything invisible.
 */
function computesLayout(document: Document): boolean {
  const agent = document.defaultView?.navigator.userAgent ?? ''
  return !/\bjsdom\b|HappyDOM/.test(agent)
}

/**
 * The dom driver's rule, for an engine with no layout: computed style up the
 * tree, through the frames the scope entered. `home` is the env's own document.
 */
function isVisibleByStyle(element: HTMLElement, home: Document): boolean {
  let current: HTMLElement | null = element
  while (current !== null) {
    const view: Window = current.ownerDocument.defaultView ?? window
    const style = view.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false
    }
    if (current.hasAttribute('hidden')) return false
    current =
      current.parentElement ??
      (current.ownerDocument === home ? null : (view.frameElement as HTMLElement | null))
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

/**
 * Angular driver. Resolution is the shared resolver, so it agrees with every
 * other in-page driver. Interactions go through user-event, as in the dom
 * driver, and each one returns only once the app is stable: zoneless, an event
 * handler that changes a signal schedules change detection rather than running
 * it, so the DOM a test reads next is the one `whenStable()` hands back.
 *
 * Each action is handed the resolved element, never a selector string, so
 * strictness and scope stay this library's rather than `querySelector`'s.
 */
export class AngularQuery extends Query {
  constructor(
    private readonly env: AngularEnv,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new AngularQuery(this.env, this.scope, selector)
  }

  /** Read per call: the body belongs to the current test, not the env. */
  protected container(): HTMLElement {
    return (this.env.root ?? document.body) as HTMLElement
  }

  protected element(options?: WaitOptions): Promise<HTMLElement> {
    return resolveOne(this.container(), this.scope, this.selector, options?.timeout)
  }

  /** Ends an action where the app does: rendered, with nothing pending. */
  protected settled(): Promise<void> {
    return settle(this.env)
  }

  /** Every match in one pass, each bound to its node. See `DomQuery.all`. */
  override async all(): Promise<Query[]> {
    return (await resolveAll(this.container(), this.scope, this.selector)).map(
      (element, index) =>
        new BoundAngularQuery(this.env, this.scope, withNth(this.selector, index), element),
    )
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    await userFor(element).click(element)
    await this.settled()
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    const user = userFor(element)
    await user.clear(element)
    // user-event throws on an empty string, and clearing is the whole intent
    // anyway — which is also what Playwright's fill('') does.
    if (value !== '') await user.type(element, value)
    await this.settled()
  }

  override async clear(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    await userFor(element).clear(element)
    await this.settled()
  }

  override async check(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if (!(element as HTMLInputElement).checked) await userFor(element).click(element)
    await this.settled()
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if ((element as HTMLInputElement).checked) await userFor(element).click(element)
    await this.settled()
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const element = (await this.element(options)) as HTMLSelectElement
    const user = userFor(element)
    // user-event adds to a multi-select's existing selection; the shared API
    // replaces it, so clear first — as the dom driver does.
    if (element.multiple) {
      const selected = [...element.selectedOptions].map(option => option.value)
      if (selected.length > 0) await user.deselectOptions(element, selected)
    }
    await user.selectOptions(element, value)
    await this.settled()
  }

  override async hover(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    await userFor(element).hover(element)
    await this.settled()
  }

  override async focus(options?: WaitOptions): Promise<void> {
    ;(await this.element(options)).focus()
    await this.settled()
  }

  override async blur(options?: WaitOptions): Promise<void> {
    ;(await this.element(options)).blur()
    await this.settled()
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    // Focus, then press: the key goes to the focused element, as in a browser.
    element.focus()
    await userFor(element).keyboard(toKeyboardInput(key))
    await this.settled()
  }

  override async upload(files: File | File[], options?: WaitOptions): Promise<void> {
    const list = Array.isArray(files) ? files : [files]
    const input = fileInputOf(await this.element(options))
    checkFileTarget(input, list.length, this.scope, this.selector)
    await userFor(input).upload(input, list)
    await this.settled()
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
      const element = await this.element(options)
      const home = this.container().ownerDocument
      // In a browser, a real layout check — Playwright's rule. Under jsdom,
      // which lays nothing out, the dom driver's computed-style walk.
      return computesLayout(home)
        ? isVisibleInLayout(element, home)
        : isVisibleByStyle(element, home)
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

  /** Under jsdom, which computes no layout, every box is all zeros. */
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
    // stable app, as every interaction does.
    await this.settled()
  }

  override async count(): Promise<number> {
    return countAll(this.container(), this.scope, this.selector)
  }
}

/** A query pinned to a node `all()` already found. See `BoundDomQuery`. */
class BoundAngularQuery extends AngularQuery {
  constructor(
    env: AngularEnv,
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

registerDriver(ANGULAR_DRIVER, (env: EnvConfig, scope, selector) => {
  return new AngularQuery(env as AngularEnv, scope, selector)
})
