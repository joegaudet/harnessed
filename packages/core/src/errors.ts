import type { Selector } from './selector'
import { describeScope } from './selector'

/**
 * Cross-driver behavioural policy that would otherwise be re-asserted inside each
 * driver. A rule stated twice is a rule free to drift, and parity is the whole
 * promise — so the rules live here and drivers feed raw values in.
 */

/**
 * Marks a violation for `instanceof`. `Symbol.for`, like the globals slot, so
 * every copy of core in a process — an ESM and a CJS build, or two bundles in
 * one page — and every realm in the engine reads the same key.
 */
const STRICT_BRAND = Symbol.for('harnessed.StrictModeViolation.v1')

/**
 * More than one node matched a query that addresses a single target.
 *
 * A class of its own so a driver can tell it apart from "not found": a yes/no
 * question such as `isVisible()` answers `false` for an absent target, but must
 * let this through, and a wait must stop on it rather than retry — more than one
 * match never becomes one by waiting.
 */
export class StrictModeViolation extends Error {
  override name = 'StrictModeViolation'

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    Object.defineProperty(this, STRICT_BRAND, { value: true })
  }

  /**
   * By brand, not by prototype: Cypress bundles a support file and each spec
   * separately, so one page can hold two copies of core, and a violation one
   * raises must still be one to the other.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Record<symbol, unknown>)[STRICT_BRAND] === true
    )
  }
}

/**
 * Both drivers raise this, with the same wording and the same scope-chain path,
 * so a failure reads identically wherever it happens.
 */
export function strictViolation(
  matches: number,
  scope: readonly Selector[],
  selector: Selector,
): StrictModeViolation {
  return new StrictModeViolation(
    `harnessed: strict mode violation — ${matches} nodes match ` +
      `${describeScope(scope, selector)}. Scope the query, or use nth()/first() only when ` +
      `the matches genuinely are the same control rendered more than once.`,
  )
}

/** Not `instanceof`: an error raised in another realm — jsdom, a same-origin
 *  frame — is an instance of that realm's `Error`, not this one's. */
function isError(value: unknown): value is Error {
  return Object.prototype.toString.call(value) === '[object Error]'
}

/**
 * Restores a strict-mode violation raised in a page a driver resolves in.
 *
 * A class does not survive the trip back to the test process. WebDriver, CDP
 * and TestCafe each hand over a plain error that keeps only the name: as its
 * `name`, or — where the transport reads the name off a minified constructor —
 * as a `StrictModeViolation: ` prefix on the message. This gives back the class
 * above with the page's message, so a remote driver's caller tells ambiguity
 * apart from absence with `instanceof`, and the failure reads exactly as it
 * does under an in-process driver. Anything else comes back as it went in.
 */
export function reviveStrictViolation<T>(error: T): T | StrictModeViolation {
  if (!isError(error) || error instanceof StrictModeViolation) return error
  const name = 'StrictModeViolation'
  const prefixed = error.message.startsWith(`${name}: `)
  if (error.name !== name && !prefixed) return error
  const message = prefixed ? error.message.slice(name.length + 2) : error.message
  return new StrictModeViolation(message, { cause: error })
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
