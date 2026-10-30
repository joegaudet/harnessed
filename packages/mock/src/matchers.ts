import type { MatcherResult } from '@harnessed-ts/core'
import { MockedRoute, partialMatch } from './handler'
import type { RecordedCall } from './types'

/** Anything that keeps a request log: a `MockedRoute`, or `api.calls(...)`'s result. */
export type Requested = MockedRoute | readonly RecordedCall[]

export interface RequestExpectation {
  /** Contained in the parsed body, compared like `withBody(subset)`. */
  body?: unknown
  query?: Record<string, string | RegExp>
  /** Names are case-insensitive. */
  headers?: Record<string, string | RegExp>
}

function callsOf(subject: Requested): readonly RecordedCall[] {
  return subject instanceof MockedRoute ? subject.calls : subject
}

function nameOf(subject: Requested): string {
  return subject instanceof MockedRoute ? subject.name : 'the requests'
}

function describe(call: RecordedCall): string {
  const body = call.body === null || call.body === undefined ? '' : ` ${JSON.stringify(call.body)}`
  return `${call.method} ${call.url}${body}`
}

function fits(call: RecordedCall, expected: RequestExpectation): boolean {
  if (expected.body !== undefined && !partialMatch(call.body, expected.body)) return false
  for (const [key, wanted] of Object.entries(expected.query ?? {})) {
    const actual = call.query[key]
    if (
      actual === undefined ||
      (typeof wanted === 'string' ? actual !== wanted : !wanted.test(actual))
    )
      return false
  }
  for (const [key, wanted] of Object.entries(expected.headers ?? {})) {
    const actual = call.headers[key.toLowerCase()]
    if (
      actual === undefined ||
      (typeof wanted === 'string' ? actual !== wanted : !wanted.test(actual))
    )
      return false
  }
  return true
}

/**
 * Runner-agnostic request assertions, in the shape of core's `harnessMatchers`,
 * so every driver's `/matchers` entry registers them with its own `expect`.
 *
 * ```ts
 * const orders = await api.post('/api/orders').reply(created({ id: 1 }))
 * await checkout.placeOrder()
 * await expect(orders).toHaveBeenRequestedWith({ body: { sku: 'A1' } })
 * ```
 */
export const mockMatchers = {
  async toHaveBeenRequested(subject: Requested): Promise<MatcherResult> {
    const count = callsOf(subject).length
    const pass = count > 0
    return {
      pass,
      observed: { actual: count, expected: '≥ 1' },
      message: () =>
        pass
          ? `expected ${nameOf(subject)} not to have been requested, but it was ${count} time(s)`
          : `expected ${nameOf(subject)} to have been requested, but it never was`,
    }
  },

  async toHaveBeenRequestedTimes(subject: Requested, times: number): Promise<MatcherResult> {
    const count = callsOf(subject).length
    const pass = count === times
    return {
      pass,
      observed: { actual: count, expected: times },
      message: () =>
        pass
          ? `expected ${nameOf(subject)} not to have been requested ${times} time(s)`
          : `expected ${nameOf(subject)} to have been requested ${times} time(s), but it was ${count}`,
    }
  },

  async toHaveBeenRequestedWith(
    subject: Requested,
    expected: RequestExpectation,
  ): Promise<MatcherResult> {
    const calls = callsOf(subject)
    const pass = calls.some(call => fits(call, expected))
    const seen = calls.map(call => `  ${describe(call)}`).join('\n')
    return {
      pass,
      observed: { actual: calls.map(describe), expected },
      message: () =>
        pass
          ? `expected ${nameOf(subject)} not to have been requested with ${JSON.stringify(expected)}`
          : `expected ${nameOf(subject)} to have been requested with ${JSON.stringify(expected)}, ` +
            (calls.length === 0 ? 'but it never was' : `but it got:\n${seen}`),
    }
  },
}
