import { Query, registerDriver } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import { checkedFrom, enabledFrom, nth as withNth, timeoutFor } from '@harnessed-ts/core'
import { waitFor as waitForCondition } from '@testing-library/dom'
import type { UserEvent } from '@testing-library/user-event'
import { DOM_DRIVER } from './driver-id'
import type { DomEnv } from './env'
import { countAll, queryAll, resolveOne, resolveScope } from './resolve'

/** Playwright key names such as `Enter` map onto user-event's `{Enter}` syntax. */
function toKeyboardInput(key: string): string {
  return key.length === 1 ? key : `{${key}}`
}

function isVisibleByStyle(element: HTMLElement): boolean {
  // jsdom computes no layout, so offsetParent is always null and getBoundingClientRect
  // is always zero. Computed style is the only signal available here.
  let current: HTMLElement | null = element
  while (current !== null) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false
    }
    if (current.hasAttribute('hidden')) return false
    current = current.parentElement
  }
  return true
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
   * Every match, resolved in one pass: the scope chain is walked once and the
   * siblings scanned once, where the inherited default re-does both per element —
   * O(N²) in Testing Library queries for a list of N.
   *
   * Each result is bound to its already-resolved node. A callback that mutates
   * the page can detach those nodes, so a bound query falls back to ordinary
   * index resolution the moment its node leaves the document.
   */
  override async all(): Promise<Query[]> {
    const root = await resolveScope(this.container, this.scope)
    return queryAll(root, this.selector).map(
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
    await this.user.click(await this.element(options))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    await this.user.clear(element)
    // user-event throws on an empty string, and clearing is the whole intent
    // anyway — which is also what Playwright's fill('') does.
    if (value !== '') await this.user.type(element, value)
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.user.clear(await this.element(options))
  }

  override async check(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if (!(element as HTMLInputElement).checked) await this.user.click(element)
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if ((element as HTMLInputElement).checked) await this.user.click(element)
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
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
    await this.user.hover(await this.element(options))
  }

  override async focus(options?: WaitOptions): Promise<void> {
    ;(await this.element(options)).focus()
  }

  override async blur(options?: WaitOptions): Promise<void> {
    ;(await this.element(options)).blur()
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    element.focus()
    await this.user.keyboard(toKeyboardInput(key))
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
      return isVisibleByStyle(await this.element(options))
    } catch {
      // Not on screen at all. Prefer isAbsent() to ask this — it answers without
      // first waiting out the retry timeout.
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
    return [...(element.selectedOptions ?? [])].map(option => option.value)
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    if (state === 'visible') {
      await waitForCondition(
        async () => {
          if (!(await this.isVisible({ timeout }))) throw new Error('not visible yet')
        },
        { timeout },
      )
      return
    }
    await waitForCondition(
      async () => {
        if ((await this.count()) !== 0 && (await this.isVisible({ timeout }))) {
          throw new Error('still visible')
        }
      },
      { timeout },
    )
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
