import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable, MatcherResult } from '@harnessed-ts/core'

/**
 * The checks `assert.harness(subject)` offers. Each is async — a harness reads
 * the page through a driver — so await it. Every one takes an optional message
 * that replaces the default.
 */
export interface HarnessAssertions {
  /** Nothing matches. */
  isAbsent(message?: string): Promise<void>
  /** Something matches. */
  isPresent(message?: string): Promise<void>
  /** `aria-pressed="true"`. */
  isSelected(message?: string): Promise<void>
  isNotSelected(message?: string): Promise<void>
  /** The text equals a string or matches a pattern. */
  readsAs(expected: string | RegExp, message?: string): Promise<void>
  doesNotReadAs(expected: string | RegExp, message?: string): Promise<void>
}

/** The slice of QUnit's `assert` these checks report through. */
interface PushResult {
  pushResult(result: {
    result: boolean
    actual: unknown
    expected: unknown
    message: string
    negative?: boolean
  }): void
}

/** The slice of the QUnit global `install` needs. */
export interface QUnitLike {
  assert: object
}

function checks(assert: PushResult, subject: Assertable): HarnessAssertions {
  const report = async (
    run: Promise<MatcherResult>,
    negated: boolean,
    message: string | undefined,
  ): Promise<void> => {
    const outcome = await run
    assert.pushResult({
      result: outcome.pass !== negated,
      actual: outcome.observed.actual,
      expected: outcome.observed.expected,
      // QUnit then reports "Expected: NOT 0" rather than an equal pair.
      negative: negated,
      // Core's message describes whichever way the check went, so a failed
      // negation already reads "expected … not to …".
      message: message ?? outcome.message(),
    })
  }

  return {
    isAbsent: message => report(harnessMatchers.toBeAbsent(subject), false, message),
    isPresent: message => report(harnessMatchers.toBeAbsent(subject), true, message),
    isSelected: message => report(harnessMatchers.toBeSelected(subject), false, message),
    isNotSelected: message => report(harnessMatchers.toBeSelected(subject), true, message),
    readsAs: (expected, message) =>
      report(harnessMatchers.toReadAs(subject, expected), false, message),
    doesNotReadAs: (expected, message) =>
      report(harnessMatchers.toReadAs(subject, expected), true, message),
  }
}

/**
 * Adds `assert.harness(subject)` to every QUnit test. Call once, from
 * `tests/test-helper` in an Ember app, before `start()`:
 *
 * ```ts
 * import QUnit from 'qunit'
 * import { install } from '@harnessed-ts/qunit'
 * install(QUnit)
 *
 * // in a test
 * await assert.harness(banner).isAbsent()
 * await assert.harness(price).readsAs(/^\$/)
 * ```
 */
export function install(qunit: QUnitLike): void {
  Object.defineProperty(qunit.assert, 'harness', {
    configurable: true,
    writable: true,
    value: function harness(this: PushResult, subject: Assertable): HarnessAssertions {
      return checks(this, subject)
    },
  })
}

declare global {
  // QUnit's `assert` is typed as this global interface.
  interface Assert {
    /** Harness checks in the qunit-dom style. Each is async: await it. */
    harness(subject: Assertable): HarnessAssertions
  }
}
