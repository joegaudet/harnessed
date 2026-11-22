import { harnessMatchers } from '@harnessed-ts/core'
import type { ValueCheck, TargetCheck } from './chain'
import { deepEqual, show, sizeOf } from './format'

function includes(haystack: unknown, needle: unknown, deep: boolean): boolean {
  const same = deep ? deepEqual : (a: unknown, b: unknown) => a === b
  if (typeof haystack === 'string') return typeof needle === 'string' && haystack.includes(needle)
  if (Array.isArray(haystack)) return haystack.some(item => same(item, needle))
  if (haystack instanceof Set) return [...haystack].some(item => same(item, needle))
  if (
    typeof haystack === 'object' &&
    haystack !== null &&
    typeof needle === 'object' &&
    needle !== null
  ) {
    // An object includes another when it has every one of its properties.
    return Object.entries(needle).every(([key, value]) =>
      same((haystack as Record<string, unknown>)[key], value),
    )
  }
  return false
}

const equal: ValueCheck = (actual, [expected], { deep }) => ({
  pass: deep ? deepEqual(actual, expected) : actual === expected,
  expected,
  phrase: `${deep ? 'deep equal' : 'equal'} ${show(expected)}`,
})

const eql: ValueCheck = (actual, [expected]) => ({
  pass: deepEqual(actual, expected),
  expected,
  phrase: `deep equal ${show(expected)}`,
})

const include: ValueCheck = (actual, [member], { deep }) => ({
  pass: includes(actual, member, deep),
  expected: member,
  phrase: `include ${show(member)}`,
})

const above: ValueCheck = (actual, [bound]) => ({
  pass: typeof actual === 'number' && actual > (bound as number),
  expected: bound,
  phrase: `be above ${show(bound)}`,
})

const below: ValueCheck = (actual, [bound]) => ({
  pass: typeof actual === 'number' && actual < (bound as number),
  expected: bound,
  phrase: `be below ${show(bound)}`,
})

const length: ValueCheck = (actual, [expected]) => ({
  pass: sizeOf(actual) === expected,
  expected,
  phrase: `have length ${show(expected)}`,
})

const is =
  (wanted: unknown): ValueCheck =>
  actual => ({ pass: actual === wanted, expected: wanted, phrase: `be ${show(wanted)}` })

/** The vocabulary `@harnessed-ts/should/register` installs. */
export const valueAssertions: Record<string, ValueCheck> = {
  null: is(null),
  true: is(true),
  false: is(false),
  undefined: is(undefined),
  equal,
  equals: equal,
  eq: equal,
  eql,
  eqls: eql,
  match: (actual, [pattern]) => ({
    // `search` ignores `lastIndex`, so a /g pattern answers the same every attempt.
    pass: typeof actual === 'string' && actual.search(pattern as RegExp) !== -1,
    expected: pattern,
    phrase: `match ${show(pattern)}`,
  }),
  include,
  includes: include,
  contain: include,
  contains: include,
  above,
  gt: above,
  greaterThan: above,
  below,
  lt: below,
  lessThan: below,
  length,
  lengthOf: length,
}

/**
 * Core's harness matchers under their should names. Every key of
 * `harnessMatchers` must appear here; a test pins it.
 */
export const targetAssertions: Record<string, TargetCheck> = {
  absent: subject => harnessMatchers.toBeAbsent(subject),
  selected: subject => harnessMatchers.toBeSelected(subject),
  readAs: (subject, [expected]) => harnessMatchers.toReadAs(subject, expected as string | RegExp),
}
