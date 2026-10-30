import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable, MatcherResult } from '@harnessed-ts/core'
import { mockMatchers } from '@harnessed-ts/mock'
import type { RequestExpectation, Requested } from '@harnessed-ts/mock'

/**
 * The structural slice of Chai a plugin is handed, so this package needs
 * neither Chai's runtime nor its types at build time — and works with Chai 4,
 * 5 and 6 alike.
 */
interface ChaiAssertionContext {
  _obj: unknown
}

interface ChaiUtils {
  flag(assertion: ChaiAssertionContext, name: string): unknown
}

interface ChaiStatic {
  Assertion: {
    addProperty(name: string, getter: (this: ChaiAssertionContext) => unknown): void
    // One overload per argument shape, so Chai's own `(...args: any[])`
    // signature stays assignable to this one.
    addMethod(
      name: string,
      method: (this: ChaiAssertionContext, expected: string | RegExp) => unknown,
    ): void
    addMethod(name: string, method: (this: ChaiAssertionContext, times: number) => unknown): void
    addMethod(
      name: string,
      method: (this: ChaiAssertionContext, expected: RequestExpectation) => unknown,
    ): void
  }
  AssertionError: new (message: string, props?: Record<string, unknown>) => Error
}

/**
 * Registers `absent`, `selected` and `readAs`, and for mocked requests
 * `requested`, `requestedTimes` and `requestedWith`:
 *
 * ```ts
 * import * as chai from 'chai'
 * import { harnessedChai } from '@harnessed-ts/chai'
 * chai.use(harnessedChai)
 *
 * await expect(banner).to.be.absent
 * await expect(card).not.to.be.selected
 * await expect(price).to.readAs(/^\$/)
 * await expect(orders).to.have.been.requestedWith({ body: { sku: 'A1' } })
 * ```
 *
 * Each takes a target or a harness and returns a promise: reading the page goes
 * through a driver, so every one of them must be awaited. The failure messages
 * are core's, shared with the Vitest and Playwright matchers.
 */
export function harnessedChai(chai: ChaiStatic, utils: ChaiUtils): void {
  const settle = async <Subject = Assertable>(
    assertion: ChaiAssertionContext,
    run: (subject: Subject) => Promise<MatcherResult>,
  ): Promise<void> => {
    const negated = utils.flag(assertion, 'negate') === true
    const result = await run(assertion._obj as Subject)
    // A matcher's message already describes whichever way it went, so a
    // negated assertion that fails reads "expected … not to …" on its own.
    if (result.pass === negated) {
      // actual/expected let Mocha and Cypress show a diff. A failed negation has
      // nothing to diff — the values agreed, which was the problem.
      throw new chai.AssertionError(result.message(), {
        actual: result.observed.actual,
        expected: result.observed.expected,
        showDiff: !negated,
      })
    }
  }

  chai.Assertion.addProperty('absent', function () {
    return settle(this, subject => harnessMatchers.toBeAbsent(subject))
  })

  chai.Assertion.addProperty('selected', function () {
    return settle(this, subject => harnessMatchers.toBeSelected(subject))
  })

  chai.Assertion.addMethod('readAs', function (expected: string | RegExp) {
    return settle(this, subject => harnessMatchers.toReadAs(subject, expected))
  })

  chai.Assertion.addProperty('requested', function () {
    return settle<Requested>(this, subject => mockMatchers.toHaveBeenRequested(subject))
  })

  chai.Assertion.addMethod('requestedTimes', function (times: number) {
    return settle<Requested>(this, subject => mockMatchers.toHaveBeenRequestedTimes(subject, times))
  })

  chai.Assertion.addMethod('requestedWith', function (expected: RequestExpectation) {
    return settle<Requested>(this, subject =>
      mockMatchers.toHaveBeenRequestedWith(subject, expected),
    )
  })
}

declare global {
  // Chai's augmentation point is this global namespace.
  namespace Chai {
    interface Assertion {
      /** Nothing matches. Await it. */
      readonly absent: Promise<void>
      /** `aria-pressed="true"`. Await it. */
      readonly selected: Promise<void>
      /** The text equals a string or matches a pattern. Await it. */
      readAs(expected: string | RegExp): Promise<void>
      /** A mocked route, or a list of calls, saw at least one request. Await it. */
      readonly requested: Promise<void>
      /** Exactly `times` requests. Await it. */
      requestedTimes(times: number): Promise<void>
      /** At least one request carried this body, query or headers. Await it. */
      requestedWith(expected: RequestExpectation): Promise<void>
    }
  }
}
