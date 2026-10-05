import { click, fillIn, getRootElement, settled } from '@ember/test-helpers'
import { Query, registerDriver } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import { checkedFrom, enabledFrom, nth as withNth, timeoutFor } from '@harnessed-ts/core'
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
import { EMBER_DRIVER } from './driver-id'
import type { EmberEnv } from './env'

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
 * Testing Library's `waitFor` retries every throw, but a frame that cannot be
 * entered never becomes enterable — so that refusal ends the wait at once.
 * Not test-helpers' `waitUntil`: its callback is synchronous, and every check
 * here resolves through the async resolver.
 */
async function waitUntil(condition: () => Promise<void>, timeout: number): Promise<void> {
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
 * dispatches them. Keys, hover, focus and selects go through user-event, as in
 * the dom driver: test-helpers' versions dispatch events without a browser's
 * default actions (a pressed key never reaches the value), refuse elements a
 * browser would accept (a disabled control, a non-focusable dialog), and match
 * options by value only.
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
    await click(await this.element(options))
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
    if (!(element as HTMLInputElement).checked) await click(element)
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if ((element as HTMLInputElement).checked) await click(element)
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const element = (await this.element(options)) as HTMLSelectElement
    const user = userFor(element)
    // user-event adds to a multi-select's existing selection; the shared API
    // replaces it, so clear first — as the dom driver does. user-event matches
    // a value or a label, and rejects one that matches no option.
    if (element.multiple) {
      const selected = [...element.selectedOptions].map(option => option.value)
      if (selected.length > 0) await user.deselectOptions(element, selected)
    }
    await user.selectOptions(element, value)
    await settled()
  }

  override async hover(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    await userFor(element).hover(element)
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
    await userFor(element).keyboard(toKeyboardInput(key))
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
      if (error instanceof FrameEntryError) throw error
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
