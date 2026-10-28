import { getConfig } from './config'
import type { Selector } from './selector'

/** What may stand before the `*` of a presence pattern: an attribute-name start. */
const PRESENCE_PREFIX = /^[A-Za-z][A-Za-z0-9_-]*$/
/** Enough for any real test id, and nothing that can close or extend a CSS selector. */
const PRESENCE_ID = /^[A-Za-z0-9_.:-]+$/

/**
 * The CSS selector `testId(id)` resolves to when the configured attribute is a
 * presence pattern — a prefix ending in `*`, such as `data-test-*`, the
 * convention of ember-test-selectors. `testId('x')` then matches every element
 * that has the attribute `data-test-x`, whatever its value, empty included.
 *
 * `undefined` for a plain attribute name, which keeps matching by value.
 *
 * A RegExp id is refused: there is no selector for "an attribute whose name
 * matches", so no driver could match it the same way.
 *
 * The id is spliced into a selector, so it is held to characters that cannot
 * change what the selector means; anything else is refused rather than escaped,
 * because a test id with a quote or a space in it is a typo.
 */
export function testIdPresenceSelector(attribute: string, id: string | RegExp): string | undefined {
  if (!attribute.endsWith('*')) return undefined
  const prefix = attribute.slice(0, -1)
  if (!PRESENCE_PREFIX.test(prefix)) {
    throw new Error(
      `harnessed: testIdAttribute ${JSON.stringify(attribute)} is not a valid pattern: ` +
        `use a plain attribute name, or a prefix ending in * such as 'data-test-*'.`,
    )
  }
  if (typeof id !== 'string') {
    // A pattern over attribute names has no CSS form, so no driver could honour it alike.
    throw new Error(
      `harnessed: testId(${String(id)}) is a RegExp, which ${attribute} test ids cannot ` +
        `match: they match an attribute by name. Pass the id as a string.`,
    )
  }
  if (!PRESENCE_ID.test(id)) {
    throw new Error(
      `harnessed: ${JSON.stringify(id)} is not a valid ${attribute} test id: use letters, ` +
        `digits, '-', '_', '.' and ':' only.`,
    )
  }
  // '.' and ':' are legal in an attribute name but mean something else in CSS.
  return `[${prefix}${id.replace(/[.:]/g, '\\$&')}]`
}

/**
 * Pushes the configured test-id attribute into whichever library actually
 * resolves the query.
 *
 * Both Testing Library and Playwright keep this in their own module-level state,
 * so it has to be pushed across rather than passed per query. Done lazily at
 * query time because `configure()` may be called after the driver was imported,
 * and memoised because the common case is that nothing changed.
 */
export function testIdSync(apply: (attribute: string) => void): () => void {
  let applied: string | undefined
  return () => {
    const wanted = getConfig().testIdAttribute
    if (wanted !== applied) {
      apply(wanted)
      applied = wanted
    }
  }
}

/**
 * Refuses, before any lookup, a test id in the chain that the configured
 * presence pattern cannot match. For a driver that resolves inside a page and
 * reads some of what the page throws as "not there": the refusal must reach
 * the caller as an error under every driver, never as a count of zero.
 */
export function checkTestIds(scope: readonly Selector[], selector: Selector): void {
  const attribute = getConfig().testIdAttribute
  if (!attribute.endsWith('*')) return
  for (const link of [...scope, selector]) {
    if (link.type === 'testId') testIdPresenceSelector(attribute, link.testId)
  }
}
