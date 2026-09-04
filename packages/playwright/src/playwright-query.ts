import { Query, registerDriver } from '@harnessed/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed/core'
import { describeSelector } from '@harnessed/core'
import type { Locator, Page } from '@playwright/test'
import { PLAYWRIGHT_DRIVER } from './driver-id'
import type { PlaywrightEnv } from './env'
import { locatorFor, timeoutFor } from './resolve'

/** Playwright driver. Every value operation goes through the Page the caller gave us. */
export class PlaywrightQuery extends Query {
  constructor(
    private readonly page: Page,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new PlaywrightQuery(this.page, this.scope, selector)
  }

  private get locator(): Locator {
    return locatorFor(this.page, this.scope, this.selector)
  }

  /**
   * Strict resolution, up front and without waiting.
   *
   * Playwright raises its own strict-mode error, but only after the action has
   * waited for the element to become actionable. More than one match will not
   * become one by waiting, and the dom driver answers immediately — so the check
   * happens here to keep the two in step and to name the selector in the message.
   */
  private async strict(options?: WaitOptions): Promise<Locator> {
    const locator = this.locator
    if (this.selector.nth === undefined) {
      const matches = await locator.count()
      if (matches > 1) {
        throw new Error(
          `harnessed: strict mode violation — ${matches} nodes match ` +
            `${describeSelector(this.selector)}. Scope the query, or use nth()/first() only ` +
            `when the matches genuinely are the same control rendered more than once.`,
        )
      }
    }
    void options
    return locator
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).click({ timeout: timeoutFor(options?.timeout) })
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).fill(value, { timeout: timeoutFor(options?.timeout) })
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).clear({ timeout: timeoutFor(options?.timeout) })
  }

  override async check(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).check({ timeout: timeoutFor(options?.timeout) })
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).uncheck({ timeout: timeoutFor(options?.timeout) })
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    await (
      await this.strict(options)
    ).selectOption(value, {
      timeout: timeoutFor(options?.timeout),
    })
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).hover({ timeout: timeoutFor(options?.timeout) })
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).focus({ timeout: timeoutFor(options?.timeout) })
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).blur({ timeout: timeoutFor(options?.timeout) })
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    await (await this.strict(options)).press(key, { timeout: timeoutFor(options?.timeout) })
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    const value = await (
      await this.strict(options)
    ).textContent({ timeout: timeoutFor(options?.timeout) })
    return (value ?? '').trim()
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    return (await this.strict(options)).inputValue({ timeout: timeoutFor(options?.timeout) })
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return (await this.strict(options)).getAttribute(name, {
      timeout: timeoutFor(options?.timeout),
    })
  }

  override async isVisible(options?: WaitOptions): Promise<boolean> {
    const locator = await this.strict(options)
    if ((await locator.count()) === 0) return false
    return locator.isVisible()
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    return (await this.strict(options)).isEnabled({ timeout: timeoutFor(options?.timeout) })
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    const locator = await this.strict(options)
    // Mirrors the dom driver: an explicit aria-checked wins, so a non-native
    // control reports the same thing under both drivers.
    const aria = await locator.getAttribute('aria-checked', {
      timeout: timeoutFor(options?.timeout),
    })
    if (aria !== null) return aria === 'true'
    return locator.isChecked({ timeout: timeoutFor(options?.timeout) })
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    const locator = await this.strict(options)
    return locator.evaluate((element: HTMLSelectElement) =>
      [...(element.selectedOptions ?? [])].map(option => option.value),
    )
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    await this.locator.waitFor({ state, timeout: timeoutFor(options?.timeout) })
  }

  override async count(): Promise<number> {
    return this.locator.count()
  }
}

registerDriver(PLAYWRIGHT_DRIVER, (env: EnvConfig, scope, selector) => {
  return new PlaywrightQuery((env as PlaywrightEnv).page, scope, selector)
})
