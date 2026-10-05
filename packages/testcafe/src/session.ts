import { ClientFunction } from 'testcafe'
import { injectSource, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'
import type { PageApiOptions, WireSelector } from '@harnessed-ts/resolve/inject'
import { currentHref, NOT_INJECTED, pageCall } from './page-functions'
import type { PageOp, PageResult } from './page-functions'

/**
 * What the driver keeps per test. Keyed by the controller: TestCafe hands every
 * test its own, and everything here belongs to exactly one test.
 */
export interface Session {
  /**
   * The top-level URL as of the last call that touched the page. `currentUrl`
   * is synchronous and TestCafe can only read the page asynchronously, so every
   * round trip brings the URL back with it and every action and navigation
   * refreshes it afterwards.
   */
  href: string | undefined
  /** Read one value through the shared resolver. */
  read(
    op: PageOp,
    scope: WireSelector[],
    selector: WireSelector,
    options: PageApiOptions,
    arg?: unknown,
  ): Promise<unknown>
  /** Re-read the top-level URL; needs no resolver, so it is safe after a navigation. */
  locate(): Promise<string>
  /**
   * Runs an operation that may switch TestCafe into an iframe. Switching is
   * state on the controller, so two such operations must never interleave —
   * and nor may a plain action, whose selector would run in the wrong window.
   */
  exclusive<T>(run: () => Promise<T>): Promise<T>
}

const sessions = new WeakMap<TestController, Session>()

/**
 * The resolver, as TestCafe sees it. Client functions are compiled when they are
 * created, so they are built once per test and take the per-call values as
 * arguments. `boundTestRun` ties them to the test explicitly: TestCafe's own
 * test-run tracking follows its promise patches, which native `await` in a
 * compiled library does not go through.
 */
export function sessionFor(t: TestController): Session {
  const existing = sessions.get(t)
  if (existing !== undefined) return existing

  const call = ClientFunction(pageCall, { boundTestRun: t })
  const href = ClientFunction(currentHref, { boundTestRun: t })
  let queue: Promise<unknown> = Promise.resolve()
  // A session starts on a page the driver has not seen, so its first call
  // carries the resolver. After that the source is sent only when a call finds
  // a fresh document — the first call after a navigation.
  let carrySource = true

  const session: Session = {
    href: undefined,
    async read(op, scope, selector, options, arg) {
      // The page answers with a value or a promise of one; awaiting flattens both.
      const run = async (source: string | null): Promise<PageResult> =>
        await call(PAGE_API_GLOBAL, source, op, scope, selector, options, arg)
      let result: PageResult
      try {
        result = await run(carrySource ? injectSource() : null)
      } catch (error) {
        if (!messageOf(error).includes(NOT_INJECTED)) throw toError(error)
        try {
          result = await run(injectSource())
        } catch (retried) {
          throw toError(retried)
        }
      }
      carrySource = false
      session.href = result.href
      return result.value
    },
    async locate() {
      try {
        session.href = await href()
      } catch (error) {
        throw toError(error)
      }
      return session.href
    },
    exclusive(run) {
      const next = queue.then(run, run)
      queue = next.catch(() => undefined)
      return next
    },
  }
  sessions.set(t, session)
  return session
}

/** A TestCafe error is a plain object; `errMsg` is the page's own error, stringified. */
interface TestCafeError {
  code?: string
  errMsg?: string
  /** A JavaScript error the page itself raised. */
  errStack?: string
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  const { errMsg } = (error ?? {}) as TestCafeError
  return typeof errMsg === 'string' ? errMsg : ''
}

/**
 * TestCafe rejects with plain objects. The specs, the page package and any
 * `catch` in a test expect an `Error` whose message is the cause — for an error
 * thrown in the page that is the resolver's own wording, so a strict-mode
 * violation reads the same here as under every other driver.
 */
export function toError(error: unknown, context?: string): Error {
  if (error instanceof Error) return error
  const { code, errMsg, errStack } = (error ?? {}) as TestCafeError
  if (typeof errMsg === 'string') {
    return new Error(errMsg.replace(/^[A-Za-z]*Error: /, ''), { cause: error })
  }
  // Anything else is TestCafe's own failure, which it renders from a code; keep
  // the code and the original object so its report stays reachable.
  const what = context === undefined ? '' : ` ${context}`
  const why = code === undefined ? '' : ` (TestCafe error ${code})`
  const page = typeof errStack === 'string' ? `: the page raised ${errStack.split('\n')[0]}` : ''
  return new Error(`harnessed: TestCafe failed${what}${why}${page}.`, { cause: error })
}
