import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable } from '@harnessed-ts/core'
import { expect } from 'expect-webdriverio'

// `import '@harnessed-ts/webdriverio/matchers'` from a spec, or the config's
// `before` hook, registers all three with the testrunner's `expect`.
expect.extend(harnessMatchers)

// expect-webdriverio declares its matchers in this global namespace.
declare global {
  namespace ExpectWebdriverIO {
    // The parameter list must match expect-webdriverio's own declaration
    // exactly. `T` is the subject, and gating on it means calling these on
    // something that is not a target or a harness is a type error rather than a
    // runtime surprise. They read the page, so they return a promise whatever
    // `R` is — as expect-webdriverio's own element matchers do.
    interface Matchers<R extends void | Promise<void>, T> {
      toBeSelected(): T extends Assertable ? Promise<Awaited<R>> : never
      toBeAbsent(): T extends Assertable ? Promise<Awaited<R>> : never
      toReadAs(expected: string | RegExp): T extends Assertable ? Promise<Awaited<R>> : never
    }
  }
}
