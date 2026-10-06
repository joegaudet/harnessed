/** A TestCafe error is a plain object; `errMsg` is the page's own error, stringified. */
interface TestCafeError {
  code?: string
  errMsg?: string
  /** A JavaScript error the page itself raised. */
  errStack?: string
  /** TestCafe's own explanation, which some codes carry (why a node is invisible). */
  reason?: string
}

/**
 * What the TestCafe codes an action most often fails with mean, in a sentence.
 * TestCafe renders these only in its own reporter, so without this a failure
 * reads as nothing but a code.
 */
const REASONS: Record<string, string> = {
  E24: 'nothing matches it',
  E26: 'it is not visible',
  E27: 'it is not an element',
  E31: 'it is not editable',
  E36: 'TestCafe has no such key',
  E39: "the iframe's content did not load",
  E40: 'it is not an <iframe>',
  E42: "the iframe's content did not load",
  E43: 'the iframe it is in no longer exists',
  E44: 'the iframe it is in is no longer visible',
  E49: 'the page unloaded while TestCafe was reading it',
  E84: 'it timed out',
  E101: 'another element covers it',
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  const { errMsg } = (error ?? {}) as TestCafeError
  return typeof errMsg === 'string' ? errMsg : ''
}

/**
 * TestCafe rejects with plain objects. The specs, the page package and any
 * `catch` in a test expect an `Error` whose message is the cause — for an error
 * thrown in the page that is the resolver's own wording, so a strict-mode
 * violation reads the same here as under every other driver.
 *
 * `context` says what was being attempted, as a verb phrase: `act on testId(x)`.
 */
export function toError(error: unknown, context?: string): Error {
  if (error instanceof Error) return error
  const { code, errMsg, errStack, reason } = (error ?? {}) as TestCafeError
  if (typeof errMsg === 'string') {
    return new Error(errMsg.replace(/^[A-Za-z]*Error: /, ''), { cause: error })
  }
  // Anything else is TestCafe's own failure, which it renders from a code; say
  // what the code means, and keep the code and the original object so its
  // report stays reachable.
  const what = context === undefined ? 'TestCafe failed' : `TestCafe could not ${context}`
  const known = code === undefined ? undefined : REASONS[code]
  const detail = typeof reason === 'string' && reason.trim() !== '' ? `: ${reason.trim()}` : ''
  const why = known === undefined ? '' : `: ${known}${detail}`
  const which = code === undefined ? '' : ` (TestCafe error ${code})`
  const page = typeof errStack === 'string' ? `: the page raised ${errStack.split('\n')[0]}` : ''
  return new Error(`harnessed: ${what}${why}${which}${page}.`, { cause: error })
}
