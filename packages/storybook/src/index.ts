import { getConfig, harnessMatchers, testIdPresenceSelector } from '@harnessed-ts/core'
import type { Assertable, ScopedHarness, ScopedHarnessConstructor } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import type { UserEvent } from '@testing-library/user-event'
import { PLAY_FUNCTION_THREW_EXCEPTION } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'
import { expect, userEvent } from 'storybook/test'
import { PLAY_ERROR_ATTRIBUTE, STORY_READY_TEST_ID } from './ready'
import { withSteps } from './steps'
import type { StepRunner } from './steps'

export { PLAY_ERROR_ATTRIBUTE, STORY_READY_TEST_ID } from './ready'
export { stepLabel, withSteps } from './steps'
export type { StepRunner } from './steps'

/** What `harnessed()` reads from, and adds to, Storybook's story context. */
export interface HarnessedContext {
  canvasElement: HTMLElement
  parameters: { harness?: ScopedHarnessConstructor }
  userEvent?: unknown
  step: StepRunner
  harness?: ScopedHarness
}

export interface HarnessedOptions {
  /**
   * Awaited after every interaction a harness makes, before the next step reads
   * the canvas. A renderer that updates the DOM asynchronously settles here;
   * `@harnessed-ts/storybook/ember` passes Ember's.
   */
  afterAction?: () => Promise<void>
}

let matchersRegistered = false
let listening = false
/** The message of the current story's play error, if it threw. */
let playError: string | undefined

/**
 * Storybook catches a play function's error, reports it on its channel, and
 * then finishes the render (running `afterEach`) as if it had passed, so the
 * error has to be caught here to reach the ready mark.
 */
function listenForPlayErrors(): void {
  if (listening || !addons.hasChannel()) return
  addons.getChannel().on(PLAY_FUNCTION_THREW_EXCEPTION, (error?: { message?: string }) => {
    playError = error?.message ?? 'the play function threw'
  })
  listening = true
}

/**
 * Preview annotations that put a harness in every play function. Spread them
 * into `.storybook/preview.ts`:
 *
 * ```ts
 * import { harnessed } from '@harnessed-ts/storybook'
 * export default { ...harnessed() } satisfies Preview
 * ```
 *
 * A story (or its meta) names its harness in `parameters.harness`, and `play`
 * receives it as `context.harness`, driving the canvas through Storybook's
 * instrumented `userEvent` with each method logged as a step. The harness
 * matchers are added to `storybook/test`'s `expect`.
 */
export function harnessed(options: HarnessedOptions = {}): {
  beforeEach: (context: HarnessedContext) => Promise<void>
  afterEach: (context: HarnessedContext) => Promise<void>
} {
  if (!matchersRegistered) {
    expect.extend(harnessMatchers)
    matchersRegistered = true
  }
  return {
    async beforeEach(context: HarnessedContext) {
      readyMarker(context.canvasElement.ownerDocument)?.remove()
      listenForPlayErrors()
      playError = undefined
      const HarnessClass = context.parameters.harness
      if (HarnessClass === undefined) return
      const env = dom({
        // Storybook's own instance, so each keystroke shows up in the panel. It
        // is only set where a clipboard exists; fall back to a plain one.
        user: (hasClick(context.userEvent) ? context.userEvent : userEvent.setup()) as UserEvent,
        container: context.canvasElement,
        ...(options.afterAction === undefined ? {} : { afterAction: options.afterAction }),
      })
      context.harness = withSteps(new HarnessClass(env), context.step)
    },
    async afterEach(context: HarnessedContext) {
      const document = context.canvasElement.ownerDocument
      if (readyMarker(document) !== null) return
      const marker = document.createElement('div')
      const attribute = getConfig().testIdAttribute
      // Under a presence pattern the id is part of the name: `data-test-<id>`.
      if (attribute.endsWith('*'))
        marker.setAttribute(attribute.slice(0, -1) + STORY_READY_TEST_ID, '')
      else marker.setAttribute(attribute, STORY_READY_TEST_ID)
      marker.hidden = true
      if (playError !== undefined) marker.setAttribute(PLAY_ERROR_ATTRIBUTE, playError)
      document.body.append(marker)
    },
  }
}

/** Found the way `testId(STORY_READY_TEST_ID)` finds it, which is what `StoryPage` waits on. */
function readyMarker(document: Document): Element | null {
  const attribute = getConfig().testIdAttribute
  const presence = testIdPresenceSelector(attribute, STORY_READY_TEST_ID)
  return document.querySelector(presence ?? `[${attribute}="${STORY_READY_TEST_ID}"]`)
}

function hasClick(value: unknown): boolean {
  return typeof (value as { click?: unknown } | undefined)?.click === 'function'
}

/**
 * A story type whose `play` receives `harness` typed as `H`.
 *
 * ```ts
 * type Story = WithHarness<StoryObj<typeof meta>, LoginFormHarness>
 * ```
 */
export type WithHarness<S, H extends ScopedHarness> = Omit<S, 'play'> & {
  play?: S extends { play?: infer P }
    ? P extends (context: infer C) => infer R
      ? (context: C & { harness: H }) => R
      : never
    : never
}

declare module 'storybook/test' {
  // The type parameter must keep Storybook's own name. Gating on `T` makes calling
  // these on something that is not a target or a harness a type error.
  interface Assertion<T> {
    toBeSelected(): T extends Assertable ? Promise<void> : never
    toBeAbsent(): T extends Assertable ? Promise<void> : never
    toReadAs(expected: string | RegExp): T extends Assertable ? Promise<void> : never
  }
}
