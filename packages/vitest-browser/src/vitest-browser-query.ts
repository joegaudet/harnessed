import { Query, registerDriver } from '@harnessed-ts/core'
import type { EnvConfig, Selector, WaitOptions } from '@harnessed-ts/core'
import {
  checkedFrom,
  enabledFrom,
  nth as withNth,
  StrictModeViolation,
  timeoutFor,
} from '@harnessed-ts/core'
import {
  countAll,
  FrameEntryError,
  isVisibleInLayout,
  resolveAll,
  resolveOne,
} from '@harnessed-ts/resolve'
import { vi } from 'vitest'
import { locators, page, userEvent } from 'vitest/browser'
import type { Locator } from 'vitest/browser'
import { VITEST_BROWSER_DRIVER } from './driver-id'
import type { VitestBrowserEnv } from './env'

declare module 'vitest/browser' {
  interface LocatorSelectors {
    /**
     * Chains a raw provider selector onto a locator. Registered by
     * `@harnessed-ts/vitest-browser` to reach into frames; not for tests.
     */
    harnessedSelector(selector: string): Locator
  }
}

// The only public way to chain an arbitrary selector after `frameLocator()`,
// which otherwise offers just the getBy* family.
locators.extend({
  harnessedSelector(selector: string) {
    return selector
  },
})

/**
 * What a provider action is handed for an element the shared resolver found.
 *
 * An element in the test's own document goes as itself. One inside an `<iframe>`
 * cannot: Vitest recognises an element with `instanceof Element`, which fails
 * across realms, and it then calls the node's own method instead — a synthetic
 * `click()`, and no `fill()` at all. So a framed element becomes a locator that
 * enters each frame on the way down, which the provider drives for real.
 */
function target<E extends Element>(element: E): E | Locator {
  return element.ownerDocument === document ? element : locatorFor(element)
}

function locatorFor(element: Element): Locator {
  if (element.ownerDocument === document) return page.elementLocator(element)
  const frame = element.ownerDocument.defaultView?.frameElement
  if (frame == null) {
    throw new Error(
      `harnessed: <${element.localName}> belongs to a document the vitest-browser driver cannot reach.`,
    )
  }
  // The element's own locator is generated against its own document, which is
  // exactly the document the frame locator has entered.
  return page
    .frameLocator(locatorFor(frame))
    .harnessedSelector(page.elementLocator(element).selector)
}

/**
 * The provider options an action is handed. Every provider action waits for its
 * element to be actionable, and the Playwright provider's own `actionTimeout`
 * defaults to none — so without this, an action that can never happen (a click
 * on a disabled button) hangs until the test itself times out.
 *
 * Not an object literal at the call site: the option interfaces are empty until
 * a provider augments them, and Playwright's is the one that declares `timeout`.
 */
function actionOptions(options?: WaitOptions): { timeout: number } {
  return { timeout: timeoutFor(options?.timeout) }
}

/** Playwright key names such as `Enter` map onto the user-event `{Enter}` syntax. */
function toKeyboardInput(key: string): string {
  return key.length === 1 ? key : `{${key}}`
}

/**
 * Vitest's own `waitFor` retries every throw, but a frame that cannot be
 * entered never becomes enterable, and several matches never become one — so
 * either ends the wait at once.
 */
async function waitUntil(condition: () => Promise<void>, timeout: number): Promise<void> {
  let refused: FrameEntryError | StrictModeViolation | undefined
  await vi.waitFor(
    async () => {
      try {
        await condition()
      } catch (error) {
        if (!(error instanceof FrameEntryError || error instanceof StrictModeViolation)) {
          throw error
        }
        refused = error
      }
    },
    { timeout },
  )
  if (refused !== undefined) throw refused
}

/**
 * Vitest browser mode driver. The test runs in the page, so resolution is the
 * shared in-process resolver; only the interactions are the provider's, which
 * makes them real browser input rather than synthesised DOM events.
 */
export class VitestBrowserQuery extends Query {
  constructor(
    private readonly container: HTMLElement,
    scope: readonly Selector[],
    selector: Selector,
  ) {
    super(scope, selector)
  }

  protected override clone(selector: Selector): Query {
    return new VitestBrowserQuery(this.container, this.scope, selector)
  }

  protected element(options?: WaitOptions): Promise<HTMLElement> {
    return resolveOne(this.container, this.scope, this.selector, options?.timeout)
  }

  /**
   * Every match, resolved in one pass: the scope chain is walked once and the
   * siblings scanned once, where the inherited default re-does both per element.
   *
   * Each result is bound to its already-resolved node. A callback that mutates
   * the page can detach those nodes, so a bound query falls back to ordinary
   * index resolution the moment its node leaves the document.
   */
  override async all(): Promise<Query[]> {
    return (await resolveAll(this.container, this.scope, this.selector)).map(
      (element, index) =>
        new BoundVitestBrowserQuery(
          this.container,
          this.scope,
          withNth(this.selector, index),
          element,
        ),
    )
  }

  // --- interactions -------------------------------------------------------

  override async click(options?: WaitOptions): Promise<void> {
    await userEvent.click(target(await this.element(options)), actionOptions(options))
  }

  override async fill(value: string, options?: WaitOptions): Promise<void> {
    // The provider's fill is Playwright's: it replaces the value, and '' clears.
    await userEvent.fill(target(await this.element(options)), value, actionOptions(options))
  }

  override async clear(options?: WaitOptions): Promise<void> {
    // The provider's clear() drops its options, so it could not be given a
    // timeout; Playwright's clear is fill('') in any case.
    await userEvent.fill(target(await this.element(options)), '', actionOptions(options))
  }

  override async check(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if (!(element as HTMLInputElement).checked) {
      await userEvent.click(target(element), actionOptions(options))
    }
  }

  override async uncheck(options?: WaitOptions): Promise<void> {
    const element = await this.element(options)
    if ((element as HTMLInputElement).checked) {
      await userEvent.click(target(element), actionOptions(options))
    }
  }

  override async selectOption(value: string | string[], options?: WaitOptions): Promise<void> {
    // Playwright's selectOption replaces a multi-select's selection, which is the
    // semantic the shared API promises, so there is nothing to clear first.
    await userEvent.selectOptions(
      target(await this.element(options)),
      value,
      actionOptions(options),
    )
  }

  override async hover(options?: WaitOptions): Promise<void> {
    await userEvent.hover(target(await this.element(options)), actionOptions(options))
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
    await userEvent.keyboard(toKeyboardInput(key))
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
      // A real browser lays the page out, so this is Playwright's layout check
      // rather than the dom driver's computed-style walk.
      return isVisibleInLayout(await this.element(options), this.container.ownerDocument)
    } catch (error) {
      // Several matches is ambiguity, not invisibility: answering false would
      // claim that nodes on screen are not.
      if (error instanceof FrameEntryError || error instanceof StrictModeViolation) throw error
      // Not on screen at all, or an index past the last match. Prefer isAbsent()
      // to ask this — it answers without first waiting out the retry timeout.
      return false
    }
  }

  override async isEnabled(options?: WaitOptions): Promise<boolean> {
    const element = await this.element(options)
    // `disabled` is inherited from an ancestor fieldset, and the DOM property
    // already accounts for that where the attribute does not.
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

  override async waitForVisible(options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    await waitUntil(async () => {
      if (!(await this.isVisible({ timeout }))) throw new Error('not visible yet')
    }, timeout)
  }

  override async waitForHidden(options?: WaitOptions): Promise<void> {
    const timeout = timeoutFor(options?.timeout)
    await waitUntil(async () => {
      if ((await this.count()) !== 0 && (await this.isVisible({ timeout }))) {
        throw new Error('still visible')
      }
    }, timeout)
  }

  override async count(): Promise<number> {
    return countAll(this.container, this.scope, this.selector)
  }
}

/** A query pinned to a node `all()` already found. See `VitestBrowserQuery.all`. */
class BoundVitestBrowserQuery extends VitestBrowserQuery {
  constructor(
    container: HTMLElement,
    scope: readonly Selector[],
    selector: Selector,
    private readonly bound: HTMLElement,
  ) {
    super(container, scope, selector)
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
registerDriver(VITEST_BROWSER_DRIVER, (env: EnvConfig, scope, selector) => {
  return new VitestBrowserQuery((env as VitestBrowserEnv).container, scope, selector)
})
