/**
 * The subset of `node:assert/strict` the catalog uses, with no Node dependency.
 *
 * The specs are executed inside browsers as well as Node — Testem for Ember,
 * Cypress, Vitest browser mode — and `node:assert` does not exist there. Rather
 * than polyfill it, the catalog imports this. Semantics match node's strict mode
 * for every form used: `equal` is `Object.is`; `deepEqual` compares arrays and
 * plain objects structurally and refuses any other object rather than guess; a
 * RegExp passed to `throws` or `rejects` is tested against `String(error)`; a
 * function is a validator that must return `true`; a string is the failure
 * message. `rejects` lets a synchronous throw escape, as node's does, so a method
 * that stops being async fails the spec instead of passing it.
 */
export interface AssertionDetails {
  actual?: unknown
  expected?: unknown
  operator?: string
  cause?: unknown
}

/**
 * Carries `actual`, `expected` and `operator` like node's, which is what lets
 * Vitest and Playwright render a structured diff instead of one flat line.
 */
export class AssertionError extends Error {
  override name = 'AssertionError'
  readonly code = 'ERR_ASSERTION'
  readonly actual: unknown
  readonly expected: unknown
  readonly operator: string | undefined

  constructor(message: string, details: AssertionDetails = {}) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause })
    this.actual = details.actual
    this.expected = details.expected
    this.operator = details.operator
  }
}

type Expected = RegExp | ((error: unknown) => boolean) | string

/** JSON, except the values JSON would make indistinguishable from others. */
function show(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, (_key, inner: unknown) => {
        if (inner === undefined) return '<undefined>'
        if (typeof inner === 'number' && Number.isNaN(inner)) return '<NaN>'
        if (Object.is(inner, -0)) return '<-0>'
        if (inner instanceof RegExp) return String(inner)
        return inner
      })
    } catch {
      return String(value)
    }
  }
  if (Object.is(value, -0)) return '-0'
  return String(value)
}

function fail(message: string | undefined, fallback: string, details?: AssertionDetails): never {
  throw new AssertionError(message ?? fallback, details)
}

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isDeepEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true
  if (typeof actual !== 'object' || typeof expected !== 'object') return false
  if (actual === null || expected === null) return false
  for (const value of [actual, expected]) {
    // A Date, Map, Set or Error has no own enumerable keys, so a key walk would
    // call any two of them equal. Refuse rather than silently pass.
    if (!Array.isArray(value) && !isPlainObject(value)) {
      throw new AssertionError(
        `deepEqual: unsupported type ${value.constructor?.name ?? 'unknown'}; compare arrays and plain objects only`,
      )
    }
  }
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)
  if (actualKeys.length !== expectedKeys.length) return false
  return actualKeys.every(
    key =>
      Object.prototype.hasOwnProperty.call(expected, key) &&
      isDeepEqual(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
      ),
  )
}

/** Checks a caught error against what the caller expected of it. */
function checkError(error: unknown, expected: Expected | undefined, verb: string): void {
  if (expected === undefined || typeof expected === 'string') return
  if (expected instanceof RegExp) {
    if (!expected.test(String(error))) {
      fail(undefined, `expected the ${verb} error to match ${expected}, but got ${String(error)}`, {
        actual: error,
        expected,
        cause: error,
      })
    }
    return
  }
  if (expected(error) !== true) {
    fail(undefined, `the ${verb} error did not satisfy the validator: ${String(error)}`, {
      actual: error,
      cause: error,
    })
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  )
}

export interface Assert {
  equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T
  ok(value: unknown, message?: string): asserts value
  deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T
  match(actual: string, pattern: RegExp, message?: string): void
  throws(fn: () => unknown, expected?: Expected): void
  rejects(fn: () => Promise<unknown>, expected?: Expected): Promise<void>
}

// Explicitly typed: TypeScript only honours `asserts` signatures when every
// name in the call target carries a declared type.
const assert: Assert = {
  equal(actual, expected, message) {
    if (!Object.is(actual, expected)) {
      const sameShape =
        typeof actual === 'object' && actual !== null && show(actual) === show(expected)
      fail(
        message,
        sameShape
          ? `expected ${show(actual)} to be the same reference, but it is a structurally equal copy`
          : `expected ${show(actual)} to equal ${show(expected)}`,
        { actual, expected, operator: 'strictEqual' },
      )
    }
  },

  ok(value, message) {
    if (!value) {
      fail(message, `expected ${show(value)} to be truthy`, {
        actual: value,
        expected: true,
        operator: '==',
      })
    }
  },

  deepEqual(actual, expected, message) {
    if (!isDeepEqual(actual, expected)) {
      fail(message, `expected ${show(actual)} to deep-equal ${show(expected)}`, {
        actual,
        expected,
        operator: 'deepStrictEqual',
      })
    }
  },

  match(actual, pattern, message) {
    if (!pattern.test(actual)) {
      fail(message, `expected ${show(actual)} to match ${pattern}`, {
        actual,
        expected: pattern,
        operator: 'match',
      })
    }
  },

  throws(fn, expected) {
    try {
      fn()
    } catch (error) {
      checkError(error, expected, 'thrown')
      return
    }
    fail(
      typeof expected === 'string' ? expected : undefined,
      'expected the function to throw, but it did not throw',
      { operator: 'throws' },
    )
  },

  async rejects(fn, expected) {
    // Outside the try, as in node: a synchronous throw is not a rejection, and
    // treating it as one would hide a method that stopped being async.
    const result: unknown = fn()
    if (!isThenable(result)) {
      fail(
        undefined,
        `expected the function to return a promise, but it returned ${show(result)}`,
        { actual: result, operator: 'rejects' },
      )
    }
    try {
      await result
    } catch (error) {
      checkError(error, expected, 'rejection')
      return
    }
    fail(
      typeof expected === 'string' ? expected : undefined,
      'expected the promise to reject, but it resolved',
      { operator: 'rejects' },
    )
  },
}

export default assert
