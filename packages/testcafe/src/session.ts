import { ClientFunction } from 'testcafe'
import { injectSource, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'
import type { PageApiOptions, WireSelector } from '@harnessed-ts/resolve/inject'
import { messageOf, toError } from './errors'
import { browserPlatform, currentHref, NOT_INJECTED, pageCall } from './page-functions'
import type { Lookup, PageOp, PageResult } from './page-functions'

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
  /**
   * One round trip through the shared resolver. Under a `now` lookup a
   * single-target operation answers `absent` rather than waiting for its node.
   */
  read(
    op: PageOp,
    scope: WireSelector[],
    selector: WireSelector,
    options: PageApiOptions,
    arg: unknown,
    lookup: Lookup,
  ): Promise<PageResult>
  /** Re-read the top-level URL; needs no resolver, so it is safe after a navigation. */
  locate(): Promise<string>
  /** The browser's `navigator.platform`, read once: it does not change mid-test. */
  platform(): Promise<string>
  /**
   * Runs an operation that may switch TestCafe into an iframe. Switching is
   * state on the controller, so two such operations must never interleave —
   * and nor may a plain action, whose selector would run in the wrong window.
   */
  exclusive<T>(run: () => Promise<T>): Promise<T>
  /** The page was replaced: the next call carries the resolver with it. */
  navigated(): void
}

const sessions = new WeakMap<TestController, Session>()

/**
 * The `t` exported by 'testcafe' is one shared proxy that looks up whichever
 * test is running when it is used. A client function bound to it does not
 * bind, and a session keyed by it would be shared by every test — so only the
 * controller a test function is handed, which carries its own test run, will do.
 */
export function assertOwnController(t: TestController): void {
  if (typeof (t as { testRun?: unknown }).testRun !== 'object') {
    throw new Error(
      "harnessed: pass the test function's own t, not the one imported from 'testcafe': " +
        "test('…', async t => { … testcafe(t) … }).",
    )
  }
}

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
  assertOwnController(t)

  const call = ClientFunction(pageCall, { boundTestRun: t })
  const href = ClientFunction(currentHref, { boundTestRun: t })
  const readPlatform = ClientFunction(browserPlatform, { boundTestRun: t })
  let platform: string | undefined
  let queue: Promise<unknown> = Promise.resolve()
  // A session starts on a page the driver has not seen, so its first call
  // carries the resolver. After that the source is sent only when the page may
  // be a fresh document — after a navigation, or once the URL has changed — and
  // when a call finds the resolver missing anyway.
  let carrySource = true
  const seen = (url: string): void => {
    if (session.href !== undefined && url !== session.href) carrySource = true
    session.href = url
  }

  const session: Session = {
    href: undefined,
    async read(op, scope, selector, options, arg, lookup) {
      // The page answers with a value or a promise of one; awaiting flattens both.
      const run = async (source: string | null): Promise<PageResult> =>
        await call(PAGE_API_GLOBAL, source, op, scope, selector, options, arg, lookup)
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
      return result
    },
    async locate() {
      let current: string
      try {
        current = await href()
      } catch (error) {
        throw toError(error)
      }
      seen(current)
      return current
    },
    async platform() {
      if (platform === undefined) {
        try {
          platform = await readPlatform()
        } catch (error) {
          throw toError(error)
        }
      }
      return platform
    },
    navigated() {
      carrySource = true
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
