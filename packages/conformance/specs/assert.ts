/**
 * The subset of `node:assert/strict` the catalog uses, with no Node dependency.
 *
 * The specs are executed inside browsers as well as Node — Testem for Ember,
 * Cypress, Vitest browser mode — and `node:assert` does not exist there. Rather
 * than polyfill it, the catalog imports this. Semantics match node's strict mode
 * for every form used: `equal` is `Object.is`, a RegExp passed to `throws` or
 * `rejects` is tested against `String(error)`, a function is a validator that
 * must return `true`, and a string is the failure message.
 */
export class AssertionError extends Error {
  override name = 'AssertionError'
}

type Expected = RegExp | ((error: unknown) => boolean) | string

function show(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  if (Object.is(value, -0)) return '-0'
  return String(value)
}

function fail(message: string | undefined, fallback: string): never {
  throw new AssertionError(message ?? fallback)
}

function isDeepEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true
  if (typeof actual !== 'object' || typeof expected !== 'object') return false
  if (actual === null || expected === null) return false
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
      fail(undefined, `expected the ${verb} error to match ${expected}, but got ${String(error)}`)
    }
    return
  }
  if (expected(error) !== true) {
    fail(undefined, `the ${verb} error did not satisfy the validator: ${String(error)}`)
  }
}

export interface Assert {
  equal<T>(actual: T, expected: T, message?: string): void
  ok(value: unknown, message?: string): asserts value
  deepEqual<T>(actual: T, expected: T, message?: string): void
  match(actual: string, pattern: RegExp, message?: string): void
  throws(fn: () => unknown, expected?: Expected): void
  rejects(fn: () => Promise<unknown>, expected?: Expected): Promise<void>
}

// Explicitly typed: TypeScript only honours `asserts value` on `ok` when every
// name in the call target carries a declared type.
const assert: Assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (!Object.is(actual, expected)) {
      fail(message, `expected ${show(actual)} to equal ${show(expected)}`)
    }
  },

  ok(value: unknown, message?: string): asserts value {
    if (!value) fail(message, `expected ${show(value)} to be truthy`)
  },

  deepEqual<T>(actual: T, expected: T, message?: string): void {
    if (!isDeepEqual(actual, expected)) {
      fail(message, `expected ${show(actual)} to deep-equal ${show(expected)}`)
    }
  },

  match(actual: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(actual)) fail(message, `expected ${show(actual)} to match ${pattern}`)
  },

  throws(fn: () => unknown, expected?: Expected): void {
    try {
      fn()
    } catch (error) {
      checkError(error, expected, 'thrown')
      return
    }
    fail(
      typeof expected === 'string' ? expected : undefined,
      'expected the function to throw, but it did not throw',
    )
  },

  async rejects(fn: () => Promise<unknown>, expected?: Expected): Promise<void> {
    try {
      await fn()
    } catch (error) {
      checkError(error, expected, 'rejection')
      return
    }
    fail(
      typeof expected === 'string' ? expected : undefined,
      'expected the promise to reject, but it resolved',
    )
  },
}

export default assert
