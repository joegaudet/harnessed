import { Query, registerDriver, registerNavigation } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import { checkedFrom, describeScope, enabledFrom, timeoutFor } from '@harnessed-ts/core'
import type { ElementHandle, KeyInput, Page } from 'puppeteer'
import { PUPPETEER_DRIVER } from './driver-id'
import type { PuppeteerEnv } from './env'
import { countIn, disposeAll, enterFrames, FrameEntryError, oneIn } from './resolve'
import type { Entered, Lookup } from './resolve'

/** How often a wait re-asks the page. Each ask is one CDP round-trip per frame crossed. */
const POLL_MS = 50

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** A resolved target: the node, plus the frames crossed to reach it. */
interface Target {
  readonly element: ElementHandle<Element>
  readonly entered: Entered
}

/**
 * Input types Playwright's `fill()` sets directly rather than types into: their
 * value is not text, so typing characters into them means nothing.
 */
const SET_VALUE_TYPES = ['color', 'date', 'time', 'datetime-local', 'month', 'range', 'week']

/**
 * Playwright's chord syntax (`Shift+ArrowLeft`, `Control+a`), which Puppeteer's
 * `press` does not parse. A lone `+` is the plus key, and `Control++` holds
 * Control while pressing it.
 */
function chord(key: string): { modifiers: string[]; key: string } {
  if (key.length <= 1) return { modifiers: [], key }
  const plus = key.endsWith('++')
  const parts = (plus ? key.slice(0, -2) : key).split('+')
  const main = plus ? '+' : (parts.pop() ?? key)
  return { modifiers: parts, key: main }
}

/**
 * Puppeteer driver. Resolution runs inside the page, through the shared
 * resolver it injects; actions go through Puppeteer's ElementHandles, so they
 * are real input events from the browser rather than synthesised DOM events.
 */
export class PuppeteerQuery extends Query {
  constructor(
    private readonly page: Page,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new PuppeteerQuery(this.page, this.scope, selector)
  }

  /**
   * The target and the frames crossed to reach it, or `null` under `now` when
   * something on the way is not on screen yet. The caller owns every handle.
   */
  private async resolve(lookup: Lookup, timeout?: number): Promise<Target | null> {
    const entered = await enterFrames(this.page, this.scope, lookup, timeout)
    if (entered === null) return null
    try {
      const element = await oneIn(
        entered.frame,
        entered.prefix,
        entered.scope,
        this.selector,
        lookup,
        timeout,
      )
      if (element === null) {
        await disposeAll(entered.hosts)
        return null
      }
      return { element, entered }
    } catch (error) {
      await disposeAll(entered.hosts)
      throw error
    }
  }

  /** The single target, waiting for it to appear. */
  private async target(timeout?: number): Promise<Target> {
    const target = await this.resolve('wait', timeout)
    // A waiting lookup finds the node or throws the resolver's own error; this
    // only narrows the type.
    if (target === null) {
      throw new Error(`harnessed: ${describeScope(this.scope, this.selector)} resolved to nothing.`)
    }
    return target
  }

  /** Resolves the single target, runs `use`, and lets go of every handle after. */
  private async withTarget<T>(
    options: WaitOptions | undefined,
    use: (element: ElementHandle<Element>) => Promise<T>,
  ): Promise<T> {
    const target = await this.target(options?.timeout)
    try {
      return await use(target.element)
    } finally {
      await release(target)
    }
  }

  /** Visible means laid out with a size, not `visibility: hidden`, in a visible frame. */
  private async visible(target: Target): Promise<boolean> {
    for (const element of [...target.entered.hosts, target.element]) {
      if (!(await element.isVisible())) return false
    }
    return true
  }

  /** Whether the target is visible now. Absent is not visible; ambiguity still throws. */
  private async visibleNow(): Promise<boolean> {
    const target = await this.resolve('now')
    if (target === null) return false
    try {
      return await this.visible(target)
    } finally {
      await release(target)
    }
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.withTarget(options, element => element.click())
  }

  /**
   * Replaces the value, as Playwright's `fill()` does: select what is there, then
   * insert the new text as one input event — or delete the selection, which is
   * what makes `fill('')` clear rather than type nothing.
   */
  override async fill(value: string, options?: WaitOptions): Promise<void> {
    await this.withTarget(options, async element => {
      const mode = await element.evaluate(
        (node, setValueTypes, next) => {
          const input = node as HTMLInputElement
          if (node.localName === 'input' && setValueTypes.includes(input.type)) {
            input.focus()
            input.value = next
            if (input.value !== next) throw new Error(`harnessed: malformed value "${next}".`)
            node.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
            node.dispatchEvent(new Event('change', { bubbles: true }))
            return 'done'
          }
          if (node.localName === 'input' || node.localName === 'textarea') {
            input.focus()
            input.select()
            return 'type'
          }
          if ((node as HTMLElement).isContentEditable) {
            ;(node as HTMLElement).focus()
            const range = node.ownerDocument.createRange()
            range.selectNodeContents(node)
            const selection = node.ownerDocument.getSelection()
            selection?.removeAllRanges()
            selection?.addRange(range)
            return 'type'
          }
          throw new Error(
            `harnessed: fill() needs an <input>, <textarea> or [contenteditable] element, not a <${node.localName}>.`,
          )
        },
        SET_VALUE_TYPES,
        value,
      )
      if (mode === 'done') return
      if (value === '') await this.page.keyboard.press('Delete')
      else await this.page.keyboard.sendCharacter(value)
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

  /** Idempotent, and verified: a click that did not change the state is an error. */
  private async setChecked(wanted: boolean, options?: WaitOptions): Promise<void> {
    await this.withTarget(options, async element => {
      if ((await checkedOf(element)) === wanted) return
      await element.click()
      if ((await checkedOf(element)) !== wanted) {
        throw new Error(
          `harnessed: clicking ${describeScope(this.scope, this.selector)} did not ${wanted ? 'check' : 'uncheck'} it.`,
        )
      }
    })
  }

  /**
   * Matches each value against an option's value, then its label, as Playwright
   * does — and replaces a multi-select's selection rather than adding to it.
   */
  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const wanted = Array.isArray(value) ? value : [value]
    await this.withTarget(options, element =>
      element.evaluate((node, values) => {
        if (node.localName !== 'select') {
          throw new Error(`harnessed: selectOption() needs a <select>, not a <${node.localName}>.`)
        }
        const select = node as HTMLSelectElement
        const all = [...select.options]
        const picked = values.map(
          want => all.find(option => option.value === want) ?? all.find(o => o.label === want),
        )
        const missing = values.filter((_, index) => picked[index] === undefined)
        if (missing.length > 0) {
          throw new Error(`harnessed: no option matches ${missing.map(m => `"${m}"`).join(', ')}.`)
        }
        if (!select.multiple && picked.length > 1) {
          throw new Error('harnessed: cannot select several options in a single-select.')
        }
        for (const option of all) option.selected = picked.includes(option)
        select.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }, wanted),
    )
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.withTarget(options, element => element.hover())
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await this.withTarget(options, element => element.focus())
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await this.withTarget(options, element =>
      element.evaluate(node => (node as HTMLElement).blur()),
    )
  }

  override async press(key: string, options?: WaitOptions): Promise<void> {
    await this.withTarget(options, async element => {
      await element.focus()
      // Puppeteer types keys as a closed union; the name is passed through as
      // Playwright spells it, and Puppeteer rejects one it does not know.
      const { modifiers, key: main } = chord(key)
      for (const modifier of modifiers) await this.page.keyboard.down(modifier as KeyInput)
      try {
        await this.page.keyboard.press(main as KeyInput)
      } finally {
        for (const modifier of modifiers.reverse()) {
          await this.page.keyboard.up(modifier as KeyInput)
        }
      }
    })
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    return this.withTarget(options, element =>
      element.evaluate(node => (node.textContent ?? '').trim()),
    )
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    return this.withTarget(options, element =>
      element.evaluate(node => (node as HTMLInputElement).value ?? ''),
    )
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return this.withTarget(options, element =>
      element.evaluate((node, attribute) => node.getAttribute(attribute), name),
    )
  }

  override async isVisible(options?: WaitOptions): Promise<boolean> {
    let target: Target
    try {
      target = await this.target(options?.timeout)
    } catch (error) {
      if (error instanceof FrameEntryError) throw error
      // Not on screen at all. Prefer isAbsent() to ask this — it answers without
      // first waiting out the retry timeout.
      return false
    }
    try {
      return await this.visible(target)
    } finally {
      await release(target)
    }
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    return this.withTarget(options, async element => {
      // `:disabled` covers a control disabled by an ancestor fieldset, which its
      // own `disabled` attribute does not.
      const [disabled, aria] = await element.evaluate(
        node => [node.matches(':disabled'), node.getAttribute('aria-disabled')] as const,
      )
      return enabledFrom(disabled, aria)
    })
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    return this.withTarget(options, element => checkedOf(element))
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    return this.withTarget(options, element =>
      element.evaluate(node =>
        [...((node as HTMLSelectElement).selectedOptions ?? [])].map(option => option.value),
      ),
    )
  }

  // --- waiting ------------------------------------------------------------

  /**
   * Polls from Node rather than waiting inside the page: the target can sit
   * behind frames, each its own document, and a navigation mid-wait would take
   * an in-page wait down with the document it ran in.
   */
  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    for (;;) {
      // A frame that cannot be entered never becomes enterable: that throws at once.
      if ((await this.visibleNow()) === (state === 'visible')) return
      if (Date.now() >= deadline) {
        throw new Error(
          `harnessed: ${describeScope(this.scope, this.selector)} did not become ${state} within ${timeout}ms.`,
        )
      }
      await sleep(POLL_MS)
    }
  }

  override async count(): Promise<number> {
    let entered: Entered | null
    try {
      entered = await enterFrames(this.page, this.scope, 'wait')
    } catch (error) {
      if (error instanceof FrameEntryError) throw error
      // A frame on the way is not on screen, so nothing inside it can be either.
      return 0
    }
    if (entered === null) return 0
    try {
      return await countIn(entered.frame, entered.prefix, entered.scope, this.selector)
    } finally {
      await disposeAll(entered.hosts)
    }
  }
}

async function release(target: Target): Promise<void> {
  await disposeAll([target.element, ...target.entered.hosts])
}

/** An explicit `aria-checked` wins over native checkedness, under every driver. */
async function checkedOf(element: ElementHandle<Element>): Promise<boolean> {
  const [aria, native] = await element.evaluate(
    node =>
      [node.getAttribute('aria-checked'), Boolean((node as HTMLInputElement).checked)] as const,
  )
  return checkedFrom(aria, native)
}

registerDriver(PUPPETEER_DRIVER, (env: EnvConfig, scope, selector) => {
  return new PuppeteerQuery((env as PuppeteerEnv).page, scope, selector)
})

/** A page's `path` is relative; Puppeteer, unlike Playwright, has no baseURL of its own. */
function absolute(env: PuppeteerEnv, url: string): string {
  const base = env.baseURL ?? env.page.url()
  try {
    return new URL(url, base).href
  } catch {
    throw new Error(
      `harnessed: cannot resolve "${url}" against "${base}". Pass a baseURL: puppeteer(page, { baseURL: 'http://localhost:3000' }).`,
    )
  }
}

/**
 * This driver can navigate, so it also registers the capability a page's
 * `goto()` runs on.
 */
registerNavigation(PUPPETEER_DRIVER, {
  async goto(env, url) {
    const puppeteerEnv = env as PuppeteerEnv
    await puppeteerEnv.page.goto(absolute(puppeteerEnv, url), { waitUntil: 'domcontentloaded' })
  },
  currentUrl(env) {
    return (env as PuppeteerEnv).page.url()
  },
  /**
   * Polled from Node: `page.url()` is tracked by Puppeteer across every kind of
   * navigation, including a client-side `history.pushState`, where an in-page
   * wait would not survive a full navigation.
   */
  async waitForUrl(env, matches, timeout) {
    const { page } = env as PuppeteerEnv
    const deadline = Date.now() + timeout
    while (!matches(new URL(page.url()))) {
      if (Date.now() >= deadline) {
        throw new Error(
          `harnessed: the URL did not match within ${timeout}ms; it is still ${page.url()}.`,
        )
      }
      await sleep(POLL_MS)
    }
  },
})
