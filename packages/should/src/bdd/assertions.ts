import type { Settled, ValueCheck } from '../chain'
import { deepEqual, show, sizeOf } from '../format'

/** Chai's type names: `null`, `array`, `date`, `regexp`, `map`, `set`, `promise`, `error`, or `typeof`. */
function typeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  for (const [type, name] of [
    [Date, 'date'],
    [RegExp, 'regexp'],
    [Map, 'map'],
    [Set, 'set'],
    [Promise, 'promise'],
    [Error, 'error'],
  ] as const) {
    if (value instanceof type) return name
  }
  return typeof value
}

const article = (word: string): string => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`)

const ofType: ValueCheck = Object.assign(
  (actual: unknown, [type]: readonly unknown[]) => ({
    pass: typeName(actual) === String(type).toLowerCase(),
    expected: type,
    phrase: `be ${article(String(type))}`,
  }),
  { chainable: true },
)

const instanceOf: ValueCheck = (actual, [type]) => ({
  pass: actual instanceof (type as new (...args: never[]) => unknown),
  expected: type,
  phrase: `be an instance of ${show(type)}`,
})

function hasProperty(own: boolean): ValueCheck {
  return (actual, args, { deep }) => {
    const [name, value] = args as [PropertyKey, unknown]
    const present =
      actual !== null &&
      actual !== undefined &&
      (own ? Object.prototype.hasOwnProperty.call(actual, name) : name in Object(actual))
    const read = present ? (actual as Record<PropertyKey, unknown>)[name] : undefined
    const matches = args.length < 2 || (deep ? deepEqual(read, value) : read === value)
    return {
      pass: present && matches,
      expected: value,
      phrase: `have ${own ? 'own property' : 'property'} ${show(name)}${
        args.length < 2 ? '' : ` of ${show(value)}`
      }`,
    }
  }
}

const atLeast: ValueCheck = (actual, [bound]) => ({
  pass: typeof actual === 'number' && actual >= (bound as number),
  expected: bound,
  phrase: `be at least ${show(bound)}`,
})

const atMost: ValueCheck = (actual, [bound]) => ({
  pass: typeof actual === 'number' && actual <= (bound as number),
  expected: bound,
  phrase: `be at most ${show(bound)}`,
})

const closeTo: ValueCheck = (actual, [expected, delta]) => ({
  pass: typeof actual === 'number' && Math.abs(actual - (expected as number)) <= (delta as number),
  expected,
  phrase: `be close to ${show(expected)} ± ${show(delta)}`,
})

function rejectedWith(settled: Settled, expected: unknown): boolean {
  if (settled.ok) return false
  if (expected === undefined) return true
  const { error } = settled
  const message = error instanceof Error ? error.message : String(error)
  if (typeof expected === 'string') return message.includes(expected)
  if (expected instanceof RegExp) return message.search(expected) !== -1
  if (typeof expected === 'function') return error instanceof expected
  return false
}

function rejection(settled: Settled): string {
  return settled.ok
    ? `it resolved ${show(settled.value)}`
    : `it rejected with ${show(settled.error)}`
}

const rejected: ValueCheck = Object.assign(
  (settled: unknown, [expected]: readonly unknown[]) => ({
    pass: rejectedWith(settled as Settled, expected),
    expected,
    phrase: expected === undefined ? 'be rejected' : `be rejected with ${show(expected)}`,
    but: rejection(settled as Settled),
  }),
  { acceptsRejection: true },
)

const is =
  (phrase: string, test: (actual: unknown) => boolean): ValueCheck =>
  actual => ({ pass: test(actual), expected: undefined, phrase })

/**
 * Chai's BDD `expect` vocabulary, as terminal calls. Installed on top of the
 * core vocabulary by `@harnessed-ts/should/bdd/register`.
 */
export const bddAssertions: Record<string, ValueCheck> = {
  ok: is('be ok', actual => Boolean(actual)),
  exist: is('exist', actual => actual !== null && actual !== undefined),
  empty: is('be empty', actual => {
    const size = sizeOf(actual)
    if (size !== undefined) return size === 0
    return typeof actual === 'object' && actual !== null && Object.keys(actual).length === 0
  }),
  a: ofType,
  an: ofType,
  instanceOf,
  instanceof: instanceOf,
  property: hasProperty(false),
  ownProperty: hasProperty(true),
  haveOwnProperty: hasProperty(true),
  keys: (actual, args) => {
    const wanted = (Array.isArray(args[0]) ? args[0] : args).map(String).sort()
    const keys = typeof actual === 'object' && actual !== null ? Object.keys(actual).sort() : []
    return { pass: deepEqual(keys, wanted), expected: wanted, phrase: `have keys ${show(wanted)}` }
  },
  members: (actual, [expected]) => {
    const wanted = expected as unknown[]
    const items = Array.isArray(actual) ? [...actual] : []
    const pass =
      items.length === wanted.length &&
      wanted.every(member => {
        const index = items.findIndex(item => deepEqual(item, member))
        if (index === -1) return false
        items.splice(index, 1)
        return true
      })
    return { pass, expected, phrase: `have members ${show(expected)}` }
  },
  oneOf: (actual, [list], { deep }) => ({
    pass: (list as unknown[]).some(item => (deep ? deepEqual(item, actual) : item === actual)),
    expected: list,
    phrase: `be one of ${show(list)}`,
  }),
  string: (actual, [part]) => ({
    pass: typeof actual === 'string' && actual.includes(part as string),
    expected: part,
    phrase: `have string ${show(part)}`,
  }),
  least: atLeast,
  gte: atLeast,
  most: atMost,
  lte: atMost,
  within: (actual, [low, high]) => ({
    pass: typeof actual === 'number' && actual >= (low as number) && actual <= (high as number),
    expected: [low, high],
    phrase: `be within ${show(low)}..${show(high)}`,
  }),
  closeTo,
  approximately: closeTo,
  satisfy: (actual, [predicate]) => ({
    pass: (predicate as (value: unknown) => boolean)(actual),
    expected: predicate,
    phrase: 'satisfy the predicate',
  }),
  NaN: is('be NaN', actual => Number.isNaN(actual)),
  finite: is('be finite', actual => Number.isFinite(actual)),
  frozen: is('be frozen', actual => Object.isFrozen(actual)),
  sealed: is('be sealed', actual => Object.isSealed(actual)),
  extensible: is('be extensible', actual => Object.isExtensible(actual)),
  rejected,
  rejectedWith: rejected,
}
