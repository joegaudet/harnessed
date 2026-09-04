import type { ComponentHarness } from './component-harness'
import type { Query } from './query'

export interface MatcherResult {
  pass: boolean
  message: () => string
}

/** Either a raw target or a harness — a harness asserts against its own host. */
export type Assertable = Query | ComponentHarness

function asQuery(subject: Assertable): Query {
  return 'self' in subject ? subject.self : subject
}

/**
 * Runner-agnostic assertion implementations, phrased the way a harness is.
 *
 * They live here rather than in a driver because they only use the public `Query`
 * surface — and because two copies of the same assertion is how two drivers start
 * disagreeing. Each driver's `/matchers` entry point registers these with its own
 * `expect`.
 *
 * The point is the failure message: `expect(await card.isSelected()).toBe(true)`
 * reports `false !== true`, which says nothing about which card or what it was.
 */
export const harnessMatchers = {
  async toBeSelected(subject: Assertable): Promise<MatcherResult> {
    const value = await asQuery(subject).attribute('aria-pressed')
    const pass = value === 'true'
    return {
      pass,
      message: () =>
        pass
          ? 'expected the target not to be selected, but aria-pressed was "true"'
          : `expected the target to be selected (aria-pressed="true"), but it was ${
              value === null ? 'unset' : `"${value}"`
            }`,
    }
  },

  async toBeAbsent(subject: Assertable): Promise<MatcherResult> {
    const count = await asQuery(subject).count()
    const pass = count === 0
    return {
      pass,
      message: () =>
        pass
          ? 'expected the target to be present, but nothing matched'
          : `expected the target to be absent, but ${count} node(s) matched`,
    }
  },

  /**
   * Deliberately not called `toHaveText`: Playwright already ships a `toHaveText`
   * for Locators, and registering over it makes the built-in receive a harness it
   * cannot read. A distinct name keeps both usable in the same suite.
   */
  async toReadAs(subject: Assertable, expected: string | RegExp): Promise<MatcherResult> {
    const actual = await asQuery(subject).text()
    const pass = typeof expected === 'string' ? actual === expected : expected.test(actual)
    return {
      pass,
      message: () =>
        pass
          ? `expected the target not to have text ${String(expected)}`
          : `expected the target to have text ${String(expected)}, but it was "${actual}"`,
    }
  },
}
