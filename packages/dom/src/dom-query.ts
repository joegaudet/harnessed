import { Query, registerDriver } from '@harnessed/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed/core'
import { getConfig } from '@harnessed/core'
import { waitFor as waitForCondition } from '@testing-library/dom'
import type { UserEvent } from '@testing-library/user-event'
import { DOM_DRIVER } from './driver-id'
import type { DomEnv } from './env'
import { countAll, resolveOne } from './resolve'

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

  private element(options?: WaitOptions): Promise<HTMLElement> {
    return resolveOne(this.container, this.scope, this.selector, options?.timeout)
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
    await this.user.selectOptions(await this.element(options), value)
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
    if (element.hasAttribute('disabled')) return false
    return element.getAttribute('aria-disabled') !== 'true'
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    const element = await this.element(options)
    if (element.getAttribute('aria-checked') !== null) {
      return element.getAttribute('aria-checked') === 'true'
    }
    return Boolean((element as HTMLInputElement).checked)
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    const element = (await this.element(options)) as HTMLSelectElement
    return [...(element.selectedOptions ?? [])].map(option => option.value)
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? getConfig().defaultTimeout
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

/**
 * Registering on import is what lets `@harnessed/core` stay driver-free: core
 * holds a registry keyed by driver id and never imports a driver itself.
 */
registerDriver(DOM_DRIVER, (env: EnvConfig, scope, selector) => {
  const domEnv = env as DomEnv
  return new DomQuery(domEnv.user, domEnv.container, scope, selector)
})
