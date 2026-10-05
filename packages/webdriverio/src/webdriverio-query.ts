import { Query, registerDriver, registerNavigation } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions } from '@harnessed-ts/core'
import {
  checkedFrom,
  describeScope,
  enabledFrom,
  StrictModeViolation,
  strictViolation,
  timeoutFor,
} from '@harnessed-ts/core'
import { WEBDRIVERIO_DRIVER } from './driver-id'
import type { WebdriverioEnv } from './env'
import { toKeySequence } from './keys'
import { lastUrl, rememberUrl } from './location'
import { isFrameEntryError, PageError } from './page-script'
import type { ElementRef, PageOp } from './page-script'
import { callPage, FrameAbsent, sendKeys, walk, wrap } from './realm'
import type { Site } from './realm'

/** How often a wait re-asks the page. Each ask is one WebDriver round-trip. */
const POLL_MS = 50

/**
 * How `isVisible` asks WebDriver. A transparent node is still laid out, takes
 * clicks and is visible to Playwright and the other layout drivers, so opacity
 * does not count; WebdriverIO's default would call `opacity: 0` hidden.
 */
const DISPLAYED = { opacityProperty: false } as const

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * WebDriver errors that mean "not actionable yet", not "wrong": the node was
 * replaced between resolving and acting (a re-render), or something covers it
 * for the moment. Playwright waits these out as actionability; so does this.
 */
function isTransient(error: unknown): boolean {
  const name = (error as Error | undefined)?.name ?? ''
  const message = (error as Error | undefined)?.message ?? ''
  return /stale element|element click intercepted|element not interactable/i.test(
    `${name} ${message}`,
  )
}

/** An option of a select, as the page reports it: its value and its trimmed label. */
interface SelectOption {
  value: string
  label: string
}

/**
 * The values of the options `asked` names. Each string matches an option's
 * value first and its visible label second, as Playwright's and user-event's
 * selectOption do; a string that matches neither is an error, not a no-op.
 */
function optionValues(
  asked: readonly string[],
  options: readonly SelectOption[],
  scope: readonly Selector[],
  selector: Selector,
): string[] {
  return asked.map(want => {
    const option =
      options.find(candidate => candidate.value === want) ??
      options.find(candidate => candidate.label === want.trim())
    if (option === undefined) {
      const choices = options.map(candidate => `"${candidate.label}" (${candidate.value})`)
      throw new Error(
        `harnessed: selectOption("${want}") on ${describeScope(scope, selector)} matches no option's value or label. Options: ${choices.join(', ')}.`,
      )
    }
    return option.value
  })
}

/**
 * An error from the page about the scope — not there, or not one node — rather
 * than a refusal or a WebDriver failure.
 */
function isScopeMiss(error: unknown): boolean {
  return (
    error instanceof FrameAbsent ||
    error instanceof StrictModeViolation ||
    (error instanceof PageError && !isFrameEntryError(error))
  )
}

/**
 * WebdriverIO driver. Resolution runs in the page — the shared resolver,
 * injected — so role, label, strictness and frame rules are the same code the
 * dom driver runs; WebDriver does the acting.
 */
export class WebdriverioQuery extends Query {
  constructor(
    private readonly browser: WebdriverIO.Browser,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new WebdriverioQuery(this.browser, this.scope, selector)
  }

  /** Resolves the target, waiting for it, and reads something off it in the same round-trip. */
  private read<T>(op: PageOp, options?: WaitOptions, arg: string | null = null): Promise<T> {
    return walk(
      this.browser,
      this.scope,
      { waiting: true, timeout: timeoutFor(options?.timeout) },
      async (site, scope, remaining) =>
        (await callPage(site, op, scope, this.selector, remaining(), arg)) as T,
    )
  }

  /**
   * Resolves the target and acts on it with WebDriver, in the document it lives
   * in. A transient failure — the node re-rendered away, or was covered — starts
   * over from resolution until the timeout runs out.
   */
  private async act<T>(
    op: PageOp,
    options: WaitOptions | undefined,
    run: (element: WebdriverIO.Element, found: Record<string, unknown>, site: Site) => Promise<T>,
  ): Promise<T> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    for (;;) {
      try {
        return await walk(
          this.browser,
          this.scope,
          { waiting: true, timeout: Math.max(0, deadline - Date.now()) },
          async (site, scope, remaining) => {
            const found = (await callPage(site, op, scope, this.selector, remaining())) as {
              element: ElementRef
            }
            return run(await wrap(site, found.element), found, site)
          },
        )
      } catch (error) {
        if (!isTransient(error) || Date.now() >= deadline) throw error
        await sleep(POLL_MS)
      }
    }
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.act('element', options, element => element.click())
  }

  /**
   * Replaces the value, like Playwright's fill: whatever was there is selected
   * and deleted by keyboard, then the new value is typed. WebDriver's own Element
   * Clear empties the field without an input event — a controlled React input
   * then still holds the old value in state while the DOM shows none.
   */
  override async fill(value: string, options?: WaitOptions): Promise<void> {
    await this.act('clear', options, async (element, found, site) => {
      // A date or colour input takes no typing; WebdriverIO sets those directly.
      if (found.direct === true) return element.setValue(value)
      if (found.filled === true) await sendKeys(site, ['Backspace'])
      if (value !== '') await element.addValue(value)
    })
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.fill('', options)
  }

  override async check(options?: WaitOptions): Promise<void> {
    await this.setChecked(true, options)
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    await this.setChecked(false, options)
  }

  private async setChecked(wanted: boolean, options?: WaitOptions): Promise<void> {
    await this.act('checked', options, async (element, found) => {
      const checked = checkedFrom(found.aria as string | null, found.native as boolean)
      if (checked !== wanted) await element.click()
    })
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const asked = Array.isArray(value) ? value : [value]
    await this.act('select', options, async (element, found) => {
      const wanted = optionValues(asked, found.options as SelectOption[], this.scope, this.selector)
      if (found.multiple !== true) {
        await element.selectByAttribute('value', wanted[0] ?? '')
        return
      }
      // Clicking an option of a multi-select toggles it, so replacing the
      // selection — the shared semantic, Playwright's — is toggling the
      // difference: off what is selected and unwanted, on what is wanted and not.
      const selected = found.selected as string[]
      const toggles = [
        ...selected.filter(option => !wanted.includes(option)),
        ...wanted.filter(option => !selected.includes(option)),
      ]
      for (const option of toggles) await element.selectByAttribute('value', option)
    })
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.act('element', options, element => element.moveTo())
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await this.read('focus', options)
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await this.read('blur', options)
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    // An unknown key name is refused before anything is focused.
    const keys = toKeySequence(key)
    // Keys go to the focused element of the document, so focus the target in
    // the same document the keys are sent to.
    await walk(
      this.browser,
      this.scope,
      { waiting: true, timeout: timeoutFor(options?.timeout) },
      async (site, scope, remaining) => {
        await callPage(site, 'focus', scope, this.selector, remaining())
        await sendKeys(site, keys)
      },
    )
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    return (await this.read<string>('text', options)).trim()
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    return this.read<string>('value', options)
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return this.read<string | null>('attribute', options, name)
  }

  /**
   * WebDriver's own visibility check, which looks at layout, applied to the
   * target and to every iframe on the way to it: content in a hidden frame is
   * hidden. Opacity is not part of it — see `DISPLAYED`. Answers at once, like
   * Playwright's — a target that is not on screen is not visible — and is
   * strict, like every single-target read.
   */
  override async isVisible(_options?: WaitOptions): Promise<boolean> {
    return this.visibleNow(1)
  }

  private async visibleNow(attempt: number): Promise<boolean> {
    try {
      return await walk(
        this.browser,
        this.scope,
        {
          waiting: false,
          timeout: 0,
          // A hidden frame hides everything in it, so there is no need to go in.
          onFrame: async iframe => {
            if (!(await iframe.isDisplayed(DISPLAYED))) throw new FrameAbsent()
          },
        },
        async (site, scope) => {
          const probe = (await callPage(site, 'probe', scope, this.selector, 0)) as {
            count: number
            element: ElementRef | null
          }
          if (probe.count > 1) throw strictViolation(probe.count, this.scope, this.selector)
          if (probe.element === null) return false
          return (await wrap(site, probe.element)).isDisplayed(DISPLAYED)
        },
      )
    } catch (error) {
      if (error instanceof FrameAbsent) return false
      // Re-rendered between the probe and the check: ask about its replacement.
      if (isTransient(error) && attempt < 3) return this.visibleNow(attempt + 1)
      throw error
    }
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    const { disabled, aria } = await this.read<{ disabled: boolean; aria: string | null }>(
      'enabled',
      options,
    )
    return enabledFrom(disabled, aria)
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    const { aria, native } = await this.read<{ aria: string | null; native: boolean }>(
      'checked',
      options,
    )
    return checkedFrom(aria, native)
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    return this.read<string[]>('selected', options)
  }

  // --- waiting ------------------------------------------------------------

  override async waitForVisible(options?: WaitOptions): Promise<void> {
    await this.waitUntilVisible(true, options)
  }

  override async waitForHidden(options?: WaitOptions): Promise<void> {
    await this.waitUntilVisible(false, options)
  }

  private async waitUntilVisible(wanted: boolean, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    for (;;) {
      // Refusals and strict violations end the wait at once: neither changes by waiting.
      if ((await this.isVisible()) === wanted) return
      const left = deadline - Date.now()
      if (left <= 0) {
        throw new Error(
          `harnessed: ${describeScope(this.scope, this.selector)} did not become ${wanted ? 'visible' : 'hidden'} within ${timeout}ms.`,
        )
      }
      await sleep(Math.min(POLL_MS, left))
    }
  }

  override async count(): Promise<number> {
    try {
      return await this.read<number>('count')
    } catch (error) {
      // A frame on the way that is not there: nothing inside it is either.
      if (isScopeMiss(error)) return 0
      throw error
    }
  }

  /**
   * Every match's text in one round-trip, where the shared loop resolves N
   * times. Trimmed to match `text()`, which the shared implementation uses.
   */
  override async texts(): Promise<string[]> {
    try {
      return (await this.read<string[]>('texts')).map(value => value.trim())
    } catch (error) {
      if (isScopeMiss(error)) return []
      throw error
    }
  }
}

registerDriver(WEBDRIVERIO_DRIVER, (env: EnvConfig, scope, selector) => {
  return new WebdriverioQuery((env as WebdriverioEnv).browser, scope, selector)
})

/**
 * This driver can navigate, so it registers the capability a page's `goto()`
 * runs on. `currentUrl` is synchronous in core's contract, and WebDriver is not:
 * it answers with the URL the driver last saw — see `location.ts`.
 */
registerNavigation(WEBDRIVERIO_DRIVER, {
  async goto(env, url) {
    const { browser } = env as WebdriverioEnv
    await browser.url(url)
    rememberUrl(browser, await browser.getUrl())
  },
  currentUrl(env) {
    return lastUrl((env as WebdriverioEnv).browser)
  },
  async waitForUrl(env, matches, timeout) {
    const { browser } = env as WebdriverioEnv
    const deadline = Date.now() + timeout
    for (;;) {
      const url = await browser.getUrl()
      rememberUrl(browser, url)
      if (matches(new URL(url))) return
      const left = deadline - Date.now()
      if (left <= 0) {
        throw new Error(`harnessed: the URL did not match within ${timeout}ms; it is ${url}.`)
      }
      await sleep(Math.min(POLL_MS, left))
    }
  },
})
