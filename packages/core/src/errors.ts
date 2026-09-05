import type { Selector } from './selector'
import { describeScope } from './selector'

/**
 * Cross-driver behavioural policy that would otherwise be re-asserted inside each
 * driver. A rule stated twice is a rule free to drift, and parity is the whole
 * promise — so the rules live here and drivers feed raw values in.
 */

/**
 * More than one node matched a query that addresses a single target.
 *
 * Both drivers raise this, with the same wording and the same scope-chain path,
 * so a failure reads identically wherever it happens.
 */
export function strictViolation(
  matches: number,
  scope: readonly Selector[],
  selector: Selector,
): Error {
  return new Error(
    `harnessed: strict mode violation — ${matches} nodes match ` +
      `${describeScope(scope, selector)}. Scope the query, or use nth()/first() only when ` +
      `the matches genuinely are the same control rendered more than once.`,
  )
}

export function indexOutOfRange(
  index: number,
  total: number,
  scope: readonly Selector[],
  selector: Selector,
): Error {
  return new Error(
    `harnessed: index ${index} is out of range — ${total} node(s) match ` +
      `${describeScope(scope, selector)}.`,
  )
}

/**
 * `last()` was asked for on a set with no members.
 *
 * Raised in place of asking a driver for index -1, which Testing Library reports
 * as an out-of-range index and Playwright reads as "the last one" before waiting
 * out the full timeout on a set that will never have members.
 */
export function emptySet(scope: readonly Selector[], selector: Selector): Error {
  return new Error(
    `harnessed: no nodes match ${describeScope(scope, selector)}, so there is no last one.`,
  )
}

/**
 * Whether a control counts as checked.
 *
 * An explicit `aria-checked` wins over native checkedness, so a non-native control
 * reports the same thing under every driver.
 */
export function checkedFrom(aria: string | null, native: boolean): boolean {
  return aria === null ? native : aria === 'true'
}

/**
 * Whether a control counts as enabled.
 *
 * `disabled` is inherited — a control inside a disabled `<fieldset>` is disabled —
 * so drivers must pass the *effective* value rather than the element's own
 * attribute, or the two disagree on exactly that case.
 */
export function enabledFrom(effectivelyDisabled: boolean, ariaDisabled: string | null): boolean {
  return !effectivelyDisabled && ariaDisabled !== 'true'
}
