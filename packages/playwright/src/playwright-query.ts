import { Query, registerDriver } from '@harnessed/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed/core'
import { checkedFrom, strictViolation, timeoutFor } from '@harnessed/core'
import type { Locator, Page } from '@playwright/test'
import { PLAYWRIGHT_DRIVER } from './driver-id'
import type { PlaywrightEnv } from './env'
import { locatorFor } from './resolve'

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
   * Runs an operation, restating a strict-mode violation in the shared wording.
   *
   * Playwright raises its own strict violation at selector-resolution time rather
   * than after the actionability wait — measured at 19ms for duplicates already
   * on the page, and as soon as they exist for ones that render late. So counting
   * up front to detect ambiguity added nothing and cost a second round-trip on
   * every single-target operation. The wording is worth keeping so a failure
   * reads the same under both drivers; that now costs a `count()` on the failure
   * path only.
   */
  private async act<T>(run: (locator: Locator) => Promise<T>): Promise<T> {
    const locator = this.locator
    try {
      return await run(locator)
    } catch (cause) {
      if (!/strict mode violation/i.test(String((cause as Error).message))) throw cause
      throw strictViolation(await locator.count(), this.scope, this.selector)
    }
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.act(l => l.click({ timeout: timeoutFor(options?.timeout) }))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    await this.act(l => l.fill(value, { timeout: timeoutFor(options?.timeout) }))
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.act(l => l.clear({ timeout: timeoutFor(options?.timeout) }))
  }

  override async check(options?: WaitOptions): Promise<void> {
    await this.act(l => l.check({ timeout: timeoutFor(options?.timeout) }))
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    await this.act(l => l.uncheck({ timeout: timeoutFor(options?.timeout) }))
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    await this.act(l => l.selectOption(value, { timeout: timeoutFor(options?.timeout) }))
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.act(l => l.hover({ timeout: timeoutFor(options?.timeout) }))
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await this.act(l => l.focus({ timeout: timeoutFor(options?.timeout) }))
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await this.act(l => l.blur({ timeout: timeoutFor(options?.timeout) }))
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    await this.act(l => l.press(key, { timeout: timeoutFor(options?.timeout) }))
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    const value = await this.act(l => l.textContent({ timeout: timeoutFor(options?.timeout) }))
    return (value ?? '').trim()
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    return this.act(l => l.inputValue({ timeout: timeoutFor(options?.timeout) }))
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return this.act(l => l.getAttribute(name, { timeout: timeoutFor(options?.timeout) }))
  }

  override async isVisible(options?: WaitOptions): Promise<boolean> {
    return this.act(async l =>
      (await l.count()) === 0 ? false : l.isVisible({ timeout: timeoutFor(options?.timeout) }),
    )
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    return this.act(l => l.isEnabled({ timeout: timeoutFor(options?.timeout) }))
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    // One round-trip for both signals, rather than an attribute read followed by
    // a separate checkedness read.
    return this.act(async l => {
      const [aria, native] = await l.evaluate(
        (element: HTMLInputElement) =>
          [element.getAttribute('aria-checked'), Boolean(element.checked)] as const,
        undefined,
        { timeout: timeoutFor(options?.timeout) },
      )
      return checkedFrom(aria, native)
    })
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    return this.act(l =>
      l.evaluate(
        (element: HTMLSelectElement) =>
          [...(element.selectedOptions ?? [])].map(option => option.value),
        undefined,
        { timeout: timeoutFor(options?.timeout) },
      ),
    )
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    await this.locator.waitFor({ state, timeout: timeoutFor(options?.timeout) })
  }

  override async count(): Promise<number> {
    return this.locator.count()
  }

  /**
   * Playwright reads every match in one round-trip, where the shared loop resolves
   * N times. Trimmed to match `text()`, which the shared implementation uses.
   */
  override async texts(): Promise<string[]> {
    return (await this.locator.allTextContents()).map(value => value.trim())
  }
}

registerDriver(PLAYWRIGHT_DRIVER, (env: EnvConfig, scope, selector) => {
  return new PlaywrightQuery((env as PlaywrightEnv).page, scope, selector)
})
