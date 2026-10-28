import { Query, registerDriver, registerNavigation } from '@harnessed-ts/core'
import type { BoundingBox, EnvConfig, FileTarget, Selector } from '@harnessed-ts/core'
import type { WaitOptions, WaitState } from '@harnessed-ts/core'
import {
  checkedFrom,
  checkFileTarget,
  describeScope,
  enabledFrom,
  StrictModeViolation,
  strictViolation,
  timeoutFor,
} from '@harnessed-ts/core'
import { filesOnDisk } from '@harnessed-ts/resolve/inject'
import { isFrameEntryError, PageError } from '@harnessed-ts/resolve/webdriver'
import type { ElementRef, PageOp } from '@harnessed-ts/resolve/webdriver'
import type { NightwatchAPI } from 'nightwatch'
import { NIGHTWATCH_DRIVER } from './driver-id'
import type { NightwatchEnv } from './env'
import { toKeySequence } from './keys'
import { lastUrl, rememberUrl } from './location'
import { callPage, FrameAbsent, walk } from './realm'
import type { Driver, Element } from './realm'

/** How often a wait re-asks the page. Each ask is one WebDriver round-trip. */
const POLL_MS = 50

const BACKSPACE = ''

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

/** Holds the keys down in order and releases them in reverse: a chord, or one key. */
async function pressKeys(driver: Driver, keys: readonly string[]): Promise<void> {
  const actions = driver.actions({ async: true })
  for (const key of keys) actions.keyDown(key)
  for (const key of [...keys].reverse()) actions.keyUp(key)
  await actions.perform()
}

/**
 * Clicks the option of `select` whose value is `value`. A click on an option
 * selects it in a single select and toggles it in a multiple one — WebDriver's
 * Element Click rules, what WebdriverIO's `selectByAttribute` does too.
 */
async function clickOption(driver: Driver, select: Element, value: string): Promise<void> {
  const option = (await driver.executeScript(
    'var options = arguments[0].options;' +
      'for (var i = 0; i < options.length; i++) if (options[i].value === arguments[1]) return options[i];' +
      'return null',
    select,
    value,
  )) as Element | null
  if (option === null) throw new Error(`harnessed: the option "${value}" went away.`)
  await option.click()
}

/**
 * Nightwatch driver. Resolution runs in the page — the shared resolver,
 * injected — so role, label, strictness and frame rules are the same code the
 * dom driver runs; selenium-webdriver, under `browser.driver`, does the acting.
 */
export class NightwatchQuery extends Query {
  constructor(
    private readonly browser: NightwatchAPI,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new NightwatchQuery(this.browser, this.scope, selector)
  }

  private get driver(): Driver {
    return this.browser.driver
  }

  /** Resolves the target, waiting for it, and reads something off it in the same round-trip. */
  private read<T>(op: PageOp, options?: WaitOptions, arg: string | null = null): Promise<T> {
    return walk(
      this.browser,
      this.scope,
      { waiting: true, timeout: timeoutFor(options?.timeout) },
      async (site, scope, remaining) =>
        (await callPage(this.browser, site, op, scope, this.selector, remaining(), arg)) as T,
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
    run: (element: Element, found: Record<string, unknown>) => Promise<T>,
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
            const found = (await callPage(
              this.browser,
              site,
              op,
              scope,
              this.selector,
              remaining(),
            )) as { element: ElementRef }
            // selenium-webdriver hands back a WebElement for the reference.
            return run(found.element as object as Element, found)
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
    await this.act('clear', options, async (element, found) => {
      // A date or colour input takes no typing; WebDriver sets those directly.
      if (found.direct === true) {
        await element.clear()
        await element.sendKeys(value)
        return
      }
      if (found.filled === true) await pressKeys(this.driver, [BACKSPACE])
      if (value !== '') await element.sendKeys(value)
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
        await clickOption(this.driver, element, wanted[0] ?? '')
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
      for (const option of toggles) await clickOption(this.driver, element, option)
    })
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.act('element', options, element =>
      this.driver.actions({ async: true }).move({ origin: element }).perform(),
    )
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
    // Keys go to the focused element of the document the session is in, so the
    // target is focused, and the keys sent, while the session is in its frame.
    await walk(
      this.browser,
      this.scope,
      { waiting: true, timeout: timeoutFor(options?.timeout) },
      async (site, scope, remaining) => {
        await callPage(this.browser, site, 'focus', scope, this.selector, remaining())
        await pressKeys(this.driver, keys)
      },
    )
  }

  /**
   * WebDriver sets files from paths typed into the input, so each File is
   * written to disk first (see `filesOnDisk`): the name and bytes arrive, and
   * the browser infers the type from the extension. The browser must share a
   * file system with this process; a remote grid needs a file detector.
   */
  override async upload(files: File | File[], options?: WaitOptions): Promise<void> {
    const list = Array.isArray(files) ? files : [files]
    await this.act('upload', options, async (element, found) => {
      checkFileTarget(found.target as FileTarget, list.length, this.scope, this.selector)
      const paths = await filesOnDisk(list)
      // A multiple input appends what is typed into it; the shared semantic
      // replaces. Emptied by script, the one value a page may set on a file
      // input: WebDriver's Element Clear on one is not something every driver
      // agrees on.
      if (found.filled === true && (found.target as { multiple: boolean }).multiple) {
        await this.driver.executeScript('arguments[0].value = ""', element)
      }
      await element.sendKeys(paths.join('\n'))
    })
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
   * The shared layout check — a non-empty box that `visibility` does not hide,
   * Playwright's rule — made in the target's own document, and in each crossed
   * iframe's: content in a hidden frame is hidden. Answers at once, like
   * Playwright's — a target that is not on screen is not visible — and is
   * strict, like every single-target read.
   */
  override async isVisible(_options?: WaitOptions): Promise<boolean> {
    try {
      return await walk(
        this.browser,
        this.scope,
        {
          waiting: false,
          timeout: 0,
          // A hidden frame hides everything in it, so there is no need to go in.
          onFrame: async (_iframe, frame) => {
            if (!frame.visible) throw new FrameAbsent()
          },
        },
        async (site, scope) => {
          const probe = (await callPage(
            this.browser,
            site,
            'visible',
            scope,
            this.selector,
            0,
          )) as {
            count: number
            visible: boolean
          }
          if (probe.count > 1) throw strictViolation(probe.count, this.scope, this.selector)
          return probe.visible
        },
      )
    } catch (error) {
      if (error instanceof FrameAbsent) return false
      throw error
    }
  }

  /** Measured in the target's own document, then offset by every frame crossed to reach it. */
  override async boundingBox(options?: WaitOptions): Promise<BoundingBox> {
    return walk(
      this.browser,
      this.scope,
      { waiting: true, timeout: timeoutFor(options?.timeout) },
      async (site, scope, remaining) => {
        const box = (await callPage(
          this.browser,
          site,
          'box',
          scope,
          this.selector,
          remaining(),
        )) as BoundingBox | null
        if (box === null) return { x: 0, y: 0, width: 0, height: 0 }
        return { ...box, x: box.x + site.origin.x, y: box.y + site.origin.y }
      },
    )
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

  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    for (;;) {
      // Refusals and strict violations end the wait at once: neither changes by waiting.
      if ((await this.isVisible()) === (state === 'visible')) return
      const left = deadline - Date.now()
      if (left <= 0) {
        throw new Error(
          `harnessed: ${describeScope(this.scope, this.selector)} did not become ${state} within ${timeout}ms.`,
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

registerDriver(NIGHTWATCH_DRIVER, (env: EnvConfig, scope, selector) => {
  return new NightwatchQuery((env as NightwatchEnv).browser, scope, selector)
})

/**
 * A relative URL resolves against the config's `launch_url`, as Nightwatch's
 * own `navigateTo` resolves it; without one, a relative path is refused here, in
 * harnessed's words, before the command runs.
 */
function checkNavigable(browser: NightwatchAPI, url: string): void {
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || browser.baseUrl) return
  throw new Error(
    `harnessed: cannot navigate to "${url}": it is relative, and the Nightwatch config sets no launch_url to resolve it against.`,
  )
}

/**
 * This driver can navigate, so it registers the capability a page's `goto()`
 * runs on: Nightwatch's `navigateTo`, which resolves the path against
 * `launch_url`. `currentUrl` is synchronous in core's contract, and WebDriver is
 * not: it answers with the URL the driver last saw — see `location.ts`.
 */
registerNavigation(NIGHTWATCH_DRIVER, {
  async goto(env, url) {
    const { browser } = env as NightwatchEnv
    checkNavigable(browser, url)
    await browser.navigateTo(url)
    rememberUrl(browser, await browser.driver.getCurrentUrl())
  },
  currentUrl(env) {
    return lastUrl((env as NightwatchEnv).browser)
  },
  async waitForUrl(env, matches, timeout) {
    const { browser } = env as NightwatchEnv
    const deadline = Date.now() + timeout
    for (;;) {
      const url = await browser.driver.getCurrentUrl()
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
