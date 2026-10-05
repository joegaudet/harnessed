import { Selector as TestCafeSelector } from 'testcafe'
import { Query, registerDriver, registerNavigation } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import { checkedFrom, describeScope, enabledFrom, getConfig, timeoutFor } from '@harnessed-ts/core'
import { encodeSelector, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'
import type { PageApiOptions } from '@harnessed-ts/resolve/inject'
import { TESTCAFE_DRIVER } from './driver-id'
import type { TestCafeEnv } from './env'
import { toTestCafeKey } from './keys'
import { pickTarget } from './page-functions'
import type { PageOp, TargetDependency } from './page-functions'
import { sessionFor, toError } from './session'
import type { Session } from './session'

/** How often a wait re-asks the page. Each ask is one short round trip. */
const POLL_MS = 50

/** A frame link's own element: the iframe itself, not the document inside it. */
function unframed(link: Selector): Selector {
  return { ...link, frame: undefined }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * TestCafe driver. Every lookup runs the shared resolver inside the page, so
 * role, label, strictness, absence and frame semantics are the dom driver's by
 * construction; TestCafe performs the actions.
 *
 * Reads are client functions that return values, which can cross into a
 * same-origin frame from the top-level window. Actions need a TestCafe
 * `Selector`, whose node must belong to the window TestCafe is switched into —
 * so an action under a frame switches into each iframe in turn, acts, and
 * always switches back.
 */
export class TestCafeQuery extends Query {
  constructor(
    private readonly t: TestController,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new TestCafeQuery(this.t, this.scope, selector)
  }

  private get session(): Session {
    return sessionFor(this.t)
  }

  /** Runtime config travels with every call: the page cannot see `configure()`. */
  private pageOptions(timeout?: number): PageApiOptions {
    return { testIdAttribute: getConfig().testIdAttribute, timeout: timeoutFor(timeout) }
  }

  private read<T>(op: PageOp, options?: WaitOptions, arg?: unknown): Promise<T> {
    return this.session.read(
      op,
      this.scope.map(encodeSelector),
      encodeSelector(this.selector),
      this.pageOptions(options?.timeout),
      arg,
    ) as Promise<T>
  }

  /** A TestCafe selector for one link of the chain, resolved by the same resolver. */
  private selectorFor(
    scope: readonly Selector[],
    selector: Selector,
    timeout: number,
  ): ReturnType<typeof TestCafeSelector> {
    const harnessedTarget: TargetDependency = {
      name: PAGE_API_GLOBAL,
      scope: scope.map(encodeSelector),
      selector: encodeSelector(selector),
      options: this.pageOptions(timeout),
    }
    return TestCafeSelector(pickTarget, {
      dependencies: { harnessedTarget },
      boundTestRun: this.t,
      timeout,
    })
  }

  /**
   * Runs a TestCafe action against this query's node.
   *
   * The resolver answers first, from the page: that is what makes a strict
   * violation, a missing target or a frame marker on a non-iframe fail at once
   * with the shared wording. An error thrown inside a TestCafe selector is
   * instead retried until the selector times out, and a strict violation never
   * becomes a single match by waiting. After that, TestCafe's own selector only
   * has to wait for the node to be actionable.
   */
  private act(
    run: (target: ReturnType<typeof TestCafeSelector>) => Promise<unknown>,
    options?: WaitOptions,
  ): Promise<void> {
    return this.session.exclusive(async () => {
      const timeout = timeoutFor(options?.timeout)
      const started = Date.now()
      await this.read('resolve', { timeout })
      const remaining = Math.max(timeout - (Date.now() - started), 0)
      const frames = this.scope.flatMap((link, index) => (link.frame === true ? [index] : []))
      try {
        for (const index of frames) {
          await this.t.switchToIframe(
            this.selectorFor(this.scope.slice(0, index), unframed(this.scope[index]!), remaining),
          )
        }
        await run(this.selectorFor(this.scope, this.selector, remaining))
      } catch (error) {
        throw toError(error, `to act on ${describeScope(this.scope, this.selector)}`)
      } finally {
        if (frames.length > 0) await this.t.switchToMainWindow()
      }
      // An action can navigate; `currentUrl` must not report the page it left.
      await this.session.locate()
    })
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.act(target => this.t.click(target), options)
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    // typeText refuses an empty string, and clearing is the whole intent anyway —
    // which is also what Playwright's fill('') does.
    if (value === '') return this.clear(options)
    // `paste` sets the whole value in one input event, as Playwright's fill does,
    // rather than typing character by character.
    await this.act(
      target => this.t.typeText(target, value, { replace: true, paste: true }),
      options,
    )
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.act(target => this.t.selectText(target).pressKey('delete'), options)
  }

  override async check(options?: WaitOptions): Promise<void> {
    if (!(await this.isChecked(options))) await this.click(options)
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    if (await this.isChecked(options)) await this.click(options)
  }

  /**
   * TestCafe has no select API, and driving a native dropdown by clicking is
   * platform-dependent. The selection is set in the page and `input` and
   * `change` dispatched — what Playwright's selectOption does — replacing any
   * existing selection of a multi-select.
   */
  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    await this.read('select', options, Array.isArray(value) ? value : [value])
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.act(target => this.t.hover(target), options)
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await this.read('focus', options)
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await this.read('blur', options)
  }

  /** Focuses the target first, as Playwright's press does; keys go to the focused node. */
  override async press(key: string, options?: WaitOptions): Promise<void> {
    await this.act(async () => {
      await this.read('focus', options)
      await this.t.pressKey(toTestCafeKey(key))
    }, options)
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    return this.read<string>('text', options)
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    return this.read<string>('value', options)
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return this.read<string | null>('attribute', options, name)
  }

  /** Answers at once, as Playwright's does: an absent target is not visible. */
  override async isVisible(options?: WaitOptions): Promise<boolean> {
    return this.read<boolean>('visible', options)
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    const [disabled, ariaDisabled] = await this.read<[boolean, string | null]>('enabled', options)
    return enabledFrom(disabled, ariaDisabled)
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    const [aria, native] = await this.read<[string | null, boolean]>('checked', options)
    return checkedFrom(aria, native)
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    return this.read<string[]>('selected', options)
  }

  // --- waiting ------------------------------------------------------------

  /**
   * Polls from Node rather than waiting inside the page. TestCafe runs one
   * command at a time, so a wait held open in the page would block every other
   * call until it settled — including after a caller such as `isReady()` has
   * stopped listening.
   */
  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    const op: PageOp = state === 'visible' ? 'visible' : 'hidden'
    for (;;) {
      if (await this.read<boolean>(op, { timeout })) return
      if (Date.now() >= deadline) {
        throw new Error(
          `harnessed: ${describeScope(this.scope, this.selector)} did not become ${state} within ${timeout}ms.`,
        )
      }
      await delay(POLL_MS)
    }
  }

  override async count(): Promise<number> {
    return this.read<number>('count')
  }

  /** Every match read in one round trip, trimmed to match `text()`. */
  override async texts(): Promise<string[]> {
    return this.read<string[]>('texts')
  }
}

registerDriver(TESTCAFE_DRIVER, (env: EnvConfig, scope, selector) => {
  return new TestCafeQuery((env as TestCafeEnv).t, scope, selector)
})

/**
 * This driver can navigate. A relative path resolves against the env's
 * `baseUrl` when it has one, and otherwise against the page the test is on.
 */
registerNavigation(TESTCAFE_DRIVER, {
  async goto(env, url) {
    const { t, baseUrl } = env as TestCafeEnv
    const session = sessionFor(t)
    const base = baseUrl ?? (await session.locate())
    let target: string
    try {
      target = new URL(url, base).href
    } catch {
      throw new Error(
        `harnessed: cannot resolve "${url}" against ${base}. Navigate to the app first, or pass ` +
          '`baseUrl` to testcafe(t, { baseUrl }).',
      )
    }
    try {
      await t.navigateTo(target)
    } catch (error) {
      throw toError(error, `to navigate to ${target}`)
    }
    await session.locate()
  },
  currentUrl(env) {
    const { href } = sessionFor((env as TestCafeEnv).t)
    if (href === undefined) {
      throw new Error(
        'harnessed: the testcafe driver has not read the URL yet. TestCafe reads the page ' +
          'asynchronously, so the URL is learned from goto() and from every harness call — ' +
          'make one of those first.',
      )
    }
    return href
  },
  async waitForUrl(env, matches, timeout) {
    const session = sessionFor((env as TestCafeEnv).t)
    const deadline = Date.now() + timeout
    for (;;) {
      const href = await session.locate()
      if (matches(new URL(href))) return
      if (Date.now() >= deadline) {
        throw new Error(`harnessed: the URL did not match within ${timeout}ms; it is ${href}.`)
      }
      await delay(POLL_MS)
    }
  },
})
