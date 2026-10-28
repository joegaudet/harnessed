import { Query, registerDriver, registerNavigation } from '@harnessed-ts/core'
import type { BoundingBox, EnvConfig, FileTarget, Selector } from '@harnessed-ts/core'
import type { WaitOptions, WaitState } from '@harnessed-ts/core'
import { checkedFrom, checkFileTarget, strictViolation, timeoutFor } from '@harnessed-ts/core'
import { Buffer } from 'node:buffer'
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

  /**
   * An interaction, which returns only once the page has had a task of its own
   * after it. Playwright resolves an action when the browser has dispatched its
   * events, but a framework may render on a later task: zoneless Angular
   * schedules change detection with `setTimeout` raced against
   * `requestAnimationFrame`, so a read straight after a click could see the
   * node it replaced. A zero-delay timer queued now runs after any the action's
   * handlers queued. The in-page drivers get the same from user-event, which
   * waits a zero-delay timer after every action.
   */
  private async perform(run: (locator: Locator) => Promise<unknown>): Promise<void> {
    await this.act(run)
    await this.page
      .evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)))
      // The action may have started a navigation that replaced the page's
      // context; then there is nothing left to wait for.
      .catch(() => undefined)
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.click({ timeout: timeoutFor(options?.timeout) }))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    await this.perform(l => l.fill(value, { timeout: timeoutFor(options?.timeout) }))
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.clear({ timeout: timeoutFor(options?.timeout) }))
  }

  override async check(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.check({ timeout: timeoutFor(options?.timeout) }))
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.uncheck({ timeout: timeoutFor(options?.timeout) }))
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    await this.perform(l => l.selectOption(value, { timeout: timeoutFor(options?.timeout) }))
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.hover({ timeout: timeoutFor(options?.timeout) }))
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.focus({ timeout: timeoutFor(options?.timeout) }))
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await this.perform(l => l.blur({ timeout: timeoutFor(options?.timeout) }))
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    await this.perform(l => l.press(key, { timeout: timeoutFor(options?.timeout) }))
  }

  override async upload(files: File | File[], options?: WaitOptions): Promise<void> {
    const list = Array.isArray(files) ? files : [files]
    const timeout = timeoutFor(options?.timeout)
    await this.perform(async l => {
      // Checked first, so a wrong target fails in the shared words rather than
      // Playwright's. Serialised into the page: the shared rule, restated.
      const target = await l.evaluate(
        (element: Element): FileTarget => {
          const control =
            element.localName === 'label' ? (element as HTMLLabelElement).control : element
          if (control === null) return '<label> with no control'
          if (control.localName !== 'input') return `<${control.localName}>`
          const input = control as HTMLInputElement
          return input.type === 'file'
            ? { multiple: input.multiple }
            : `<input type="${input.type}">`
        },
        undefined,
        { timeout },
      )
      checkFileTarget(target, list.length, this.scope, this.selector)
      const payloads = await Promise.all(
        list.map(async file => ({
          name: file.name,
          mimeType: file.type,
          buffer: Buffer.from(await file.arrayBuffer()),
        })),
      )
      await l.setInputFiles(payloads, { timeout })
    })
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

  /** Playwright's own box, relative to the main frame's viewport; `null` (no box) reads as zeros. */
  override async boundingBox(options?: WaitOptions): Promise<BoundingBox> {
    const box = await this.act(l => l.boundingBox({ timeout: timeoutFor(options?.timeout) }))
    return box ?? { x: 0, y: 0, width: 0, height: 0 }
  }

  // --- waiting ------------------------------------------------------------

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    await this.act(l => l.waitFor({ state, timeout: timeoutFor(options?.timeout) }))
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

/**
 * This driver can navigate, so it also registers the capability a page's `goto()`
 * runs on. A driver without one still supports every harness and page — only
 * `goto()` and the URL members need a URL.
 */
registerNavigation(PLAYWRIGHT_DRIVER, {
  async goto(env, url) {
    await (env as PlaywrightEnv).page.goto(url, { waitUntil: 'domcontentloaded' })
  },
  currentUrl(env) {
    return (env as PlaywrightEnv).page.url()
  },
  async waitForUrl(env, matches, timeout) {
    await (env as PlaywrightEnv).page.waitForURL(url => matches(url), { timeout })
  },
})
