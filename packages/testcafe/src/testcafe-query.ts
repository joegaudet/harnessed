import { Selector as TestCafeSelector } from 'testcafe'
import { Query, registerDriver, registerNavigation } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions, WaitState } from '@harnessed-ts/core'
import { checkedFrom, describeScope, enabledFrom, getConfig, timeoutFor } from '@harnessed-ts/core'
import { encodeSelector, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'
import type { PageApiOptions } from '@harnessed-ts/resolve/inject'
import { TESTCAFE_DRIVER } from './driver-id'
import type { TestCafeEnv } from './env'
import { toError } from './errors'
import { toTestCafeKey } from './keys'
import { pickTarget } from './page-functions'
import type { Editable, PageOp, SelectArg, TargetDependency } from './page-functions'
import { sessionFor } from './session'
import type { Session } from './session'

/** How often a wait re-asks the page. Each ask is one short round trip. */
const POLL_MS = 50

/**
 * The last poll of a single-target read waits in the page this long, so that a
 * target never found fails in the resolver's own words.
 */
const LAST_WAIT_MS = POLL_MS

/** Why a text control cannot be typed into yet. */
const NOT_EDITABLE: Record<'disabled' | 'readonly', string> = {
  disabled: 'it is disabled',
  readonly: 'it is readonly',
}

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
 *
 * TestCafe runs one command at a time, so nothing here waits inside the page
 * for long: a wait held open there would block every other call until it
 * settled — including after a caller such as `isReady()` has stopped
 * listening. Single-target and list reads poll from Node instead.
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

  private get described(): string {
    return describeScope(this.scope, this.selector)
  }

  /** Runtime config travels with every call: the page cannot see `configure()`. */
  private pageOptions(timeout?: number): PageApiOptions {
    return { testIdAttribute: getConfig().testIdAttribute, timeout: timeoutFor(timeout) }
  }

  /** One round trip, answered at once. */
  private async read<T>(op: PageOp, options?: WaitOptions, arg?: unknown): Promise<T> {
    const result = await this.session.read(
      op,
      this.scope.map(encodeSelector),
      encodeSelector(this.selector),
      this.pageOptions(options?.timeout),
      arg,
      'now',
    )
    return result.value as T
  }

  /**
   * A list operation, polled from Node until its scope is there, as every
   * driver waits for the scope; the list itself answers at once. A scope that
   * never appears holds nothing, so the deadline answers `empty` rather than
   * failing.
   */
  private async readList<T>(op: 'count' | 'texts', empty: T): Promise<T> {
    const timeout = timeoutFor()
    const deadline = Date.now() + timeout
    const scope = this.scope.map(encodeSelector)
    const selector = encodeSelector(this.selector)
    for (;;) {
      const result = await this.session.read(
        op,
        scope,
        selector,
        this.pageOptions(timeout),
        undefined,
        'now',
      )
      if (result.absent !== true) return result.value as T
      if (Date.now() >= deadline) return empty
      await delay(POLL_MS)
    }
  }

  /**
   * A single-target operation, polled from Node until its node is there. The
   * last poll waits briefly in the page, so a target that never appears fails
   * with the resolver's own message; a strict violation fails on the first.
   */
  private async readOne<T>(op: PageOp, options?: WaitOptions, arg?: unknown): Promise<T> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    const scope = this.scope.map(encodeSelector)
    const selector = encodeSelector(this.selector)
    for (;;) {
      const last = Date.now() >= deadline
      const result = await this.session.read(
        op,
        scope,
        selector,
        this.pageOptions(last ? LAST_WAIT_MS : timeout),
        arg,
        last ? 'wait' : 'now',
      )
      if (result.absent !== true) return result.value as T
      await delay(POLL_MS)
    }
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
   * becomes a single match by waiting. `prepare` then refuses what TestCafe
   * would get silently wrong, within the same deadline. After that, TestCafe's
   * own selectors only have to wait for the node to be actionable — each frame
   * switch and the action given what is left of that one deadline, so the
   * whole operation fails within the caller's timeout.
   */
  private act(
    run: (target: ReturnType<typeof TestCafeSelector>, deadline: number) => Promise<unknown>,
    options?: WaitOptions,
    prepare?: (deadline: number, timeout: number) => Promise<void>,
  ): Promise<void> {
    return this.session.exclusive(async () => {
      const timeout = timeoutFor(options?.timeout)
      const deadline = Date.now() + timeout
      await this.readOne('resolve', { timeout })
      if (prepare !== undefined) await prepare(deadline, timeout)
      const remaining = (): number => Math.max(deadline - Date.now(), 0)
      const frames = this.scope.flatMap((link, index) => (link.frame === true ? [index] : []))
      try {
        for (const index of frames) {
          await this.t.switchToIframe(
            this.selectorFor(this.scope.slice(0, index), unframed(this.scope[index]!), remaining()),
          )
        }
        await run(this.selectorFor(this.scope, this.selector, remaining()), deadline)
      } catch (error) {
        throw toError(error, `act on ${this.described}`)
      } finally {
        if (frames.length > 0) await this.t.switchToMainWindow()
      }
      // An action can navigate; `currentUrl` must not report the page it left.
      await this.session.locate()
    })
  }

  /**
   * Waits until the target can be typed into, and refuses one that never can.
   * TestCafe's typeText would otherwise do nothing to a disabled or readonly
   * control, and type into the first editable descendant of a wrapper.
   */
  private async editable(action: 'fill' | 'clear', deadline: number, timeout: number) {
    for (;;) {
      const state = await this.readOne<Editable>('editable', {
        timeout: Math.max(deadline - Date.now(), 0),
      })
      if (state === 'ok') return
      if (state !== 'disabled' && state !== 'readonly') {
        throw new Error(
          `harnessed: ${action}() needs an <input>, <textarea> or [contenteditable] element, but ${this.described} is a ${state}.`,
        )
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `harnessed: ${action}() could not edit ${this.described} within ${timeout}ms: ${NOT_EDITABLE[state]}.`,
        )
      }
      await delay(POLL_MS)
    }
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await this.act(target => this.t.click(target), options)
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    await this.replaceValue('fill', value, options)
  }

  override async clear(options?: WaitOptions): Promise<void> {
    await this.replaceValue('clear', '', options)
  }

  /**
   * Replaces the value, as Playwright's `fill()` does. `paste` sets the whole
   * value in one input event rather than typing character by character; an
   * empty value — which typeText refuses — selects what is there and deletes
   * it, so `fill('')` and `clear()` are one operation with one set of checks.
   */
  private async replaceValue(
    action: 'fill' | 'clear',
    value: string,
    options?: WaitOptions,
  ): Promise<void> {
    await this.act(
      target =>
        value === ''
          ? this.t.selectText(target).pressKey('delete')
          : this.t.typeText(target, value, { replace: true, paste: true }),
      options,
      (deadline, timeout) => this.editable(action, deadline, timeout),
    )
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
   * existing selection of a multi-select. A change handler can navigate, so
   * this is an action like any other: it takes its turn, and re-reads the URL.
   */
  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    const arg: SelectArg = {
      values: Array.isArray(value) ? value : [value],
      target: this.described,
    }
    await this.session.exclusive(async () => {
      await this.readOne('select', options, arg)
      await this.session.locate()
    })
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await this.act(target => this.t.hover(target), options)
  }

  override async focus(options?: WaitOptions): Promise<void> {
    await this.readOne('focus', options)
  }

  override async blur(options?: WaitOptions): Promise<void> {
    await this.readOne('blur', options)
  }

  /**
   * Focuses the target first, as Playwright's press does; keys go to the
   * focused node. The key is checked before anything happens, and the focus
   * spends only what is left of the one timeout. `ControlOrMeta` follows the
   * browser's platform, which may not be the test runner's.
   */
  override async press(key: string, options?: WaitOptions): Promise<void> {
    const platform = key.includes('ControlOrMeta') ? await this.session.platform() : undefined
    const keys = toTestCafeKey(key, platform)
    await this.act(async (_target, deadline) => {
      await this.readOne('focus', { timeout: Math.max(deadline - Date.now(), 0) })
      await this.t.pressKey(keys)
    }, options)
  }

  // --- observations -------------------------------------------------------

  override async text(options?: WaitOptions): Promise<string> {
    return this.readOne<string>('text', options)
  }

  override async inputValue(options?: WaitOptions): Promise<string> {
    return this.readOne<string>('value', options)
  }

  override async attribute(name: string, options?: WaitOptions): Promise<string | null> {
    return this.readOne<string | null>('attribute', options, name)
  }

  /** Answers at once, as Playwright's does: an absent target is not visible. */
  override async isVisible(options?: WaitOptions): Promise<boolean> {
    return this.read<boolean>('visible', options)
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    const [disabled, ariaDisabled] = await this.readOne<[boolean, string | null]>(
      'enabled',
      options,
    )
    return enabledFrom(disabled, ariaDisabled)
  }

  override async isChecked(options?: WaitOptions): Promise<boolean> {
    const [aria, native] = await this.readOne<[string | null, boolean]>('checked', options)
    return checkedFrom(aria, native)
  }

  override async selectedOptions(options?: WaitOptions): Promise<string[]> {
    return this.readOne<string[]>('selected', options)
  }

  // --- waiting ------------------------------------------------------------

  /** Polls from Node rather than waiting inside the page, as every read here does. */
  override async waitFor(state: WaitState, options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    const deadline = Date.now() + timeout
    for (;;) {
      if (await this.read<boolean>(state, { timeout })) return
      if (Date.now() >= deadline) {
        throw new Error(`harnessed: ${this.described} did not become ${state} within ${timeout}ms.`)
      }
      await delay(POLL_MS)
    }
  }

  /** Waits for the scope chain, as every driver does; the count itself answers at once. */
  override async count(): Promise<number> {
    return this.readList<number>('count', 0)
  }

  /** Every match read in one round trip, once the scope is there; trimmed to match `text()`. */
  override async texts(): Promise<string[]> {
    return this.readList<string[]>('texts', [])
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
      throw toError(error, `navigate to ${target}`)
    } finally {
      // A new document, which has no resolver until one is sent.
      session.navigated()
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
