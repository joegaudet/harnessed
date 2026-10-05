import { harnessMatchers, Query, ScopedHarness } from '@harnessed-ts/core'
import type { Assertable, MatcherResult } from '@harnessed-ts/core'
import { expect } from 'expect-webdriverio'

/**
 * Where `expect` keeps its registered matchers — the global the `expect`
 * package itself reads them from, shared by every copy of it in the process.
 */
const MATCHERS = Symbol.for('$$jest-matchers-object')

type Matcher = (this: unknown, subject: unknown, ...args: unknown[]) => Promise<MatcherResult>

function registered(name: string): Matcher | undefined {
  const store = (globalThis as { [MATCHERS]?: { matchers?: Record<string, Matcher> } })[MATCHERS]
  return store?.matchers?.[name]
}

function isAssertable(subject: unknown): subject is Assertable {
  return subject instanceof Query || subject instanceof ScopedHarness
}

/**
 * expect-webdriverio already has a `toBeSelected`, for elements: WebDriver's
 * `isSelected`, on an `<option>`, checkbox or radio. Registering harnessed's
 * under the same name would take that one away, so a harness or a query gets
 * harnessed's (`aria-pressed`) and anything else is handed to the one that was
 * there before.
 */
const elementToBeSelected = registered('toBeSelected')

// `import '@harnessed-ts/webdriverio/matchers'` from a spec, or the config's
// `before` hook, registers all three with the testrunner's `expect`.
expect.extend({
  ...harnessMatchers,
  async toBeSelected(this: unknown, subject: unknown, ...args: unknown[]): Promise<MatcherResult> {
    if (isAssertable(subject)) return harnessMatchers.toBeSelected(subject)
    if (elementToBeSelected !== undefined) return elementToBeSelected.call(this, subject, ...args)
    throw new TypeError(
      'harnessed: toBeSelected() takes a harness or a query; the element matcher of expect-webdriverio is not registered.',
    )
  },
})

/**
 * What `expect(harnessOrQuery)` returns: expect-webdriverio's matchers, with
 * harnessed's `toBeSelected` in place of the element one. The element one is
 * typed `never` for anything that is not an element, and no declaration on
 * `Matchers` can widen an inherited member — so harness subjects get their own
 * `expect` overload instead.
 */
type HarnessSelected = { toBeSelected(): Promise<void> }
type HarnessExpectation<T> = Omit<
  ExpectWebdriverIO.MatchersAndInverse<void, T>,
  'toBeSelected' | 'not'
> &
  HarnessSelected & {
    not: Omit<ExpectWebdriverIO.MatchersAndInverse<void, T>['not'], 'toBeSelected'> &
      HarnessSelected
  }

// expect-webdriverio declares its matchers in this global namespace.
declare global {
  namespace ExpectWebdriverIO {
    interface Expect {
      // Declared after expect-webdriverio's own call signature, so tried first.
      <T extends Assertable>(actual: T): HarnessExpectation<T>
    }

    // The parameter list must match expect-webdriverio's own declaration
    // exactly. `T` is the subject, and gating on it means calling these on
    // something that is not a target or a harness is a type error rather than a
    // runtime surprise. They read the page, so they return a promise whatever
    // `R` is — as expect-webdriverio's own element matchers do.
    interface Matchers<R extends void | Promise<void>, T> {
      toBeAbsent(): T extends Assertable ? Promise<Awaited<R>> : never
      toReadAs(expected: string | RegExp): T extends Assertable ? Promise<Awaited<R>> : never
    }
  }
}
