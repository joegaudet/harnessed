import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable } from '@harnessed-ts/core'
import { mockMatchers } from '@harnessed-ts/mock'
import type { RequestExpectation, Requested } from '@harnessed-ts/mock'
import { expect } from 'vitest'

// `import '@harnessed-ts/vitest-browser/matchers'` from a setup file registers all
// three. Browser mode runs the same `expect` as Node, so this is the dom
// driver's registration unchanged.
expect.extend(harnessMatchers)
expect.extend(mockMatchers)

declare module 'vitest' {
  // The parameter list must match vitest's own declaration exactly. `T` is the
  // subject, and gating on it means calling these on something that is not a
  // target or a harness is a type error rather than a runtime surprise.
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toBeSelected(): T extends Assertable ? R : never
    toBeAbsent(): T extends Assertable ? R : never
    toReadAs(expected: string | RegExp): T extends Assertable ? R : never
    toHaveBeenRequested(): T extends Requested ? R : never
    toHaveBeenRequestedTimes(times: number): T extends Requested ? R : never
    toHaveBeenRequestedWith(expected: RequestExpectation): T extends Requested ? R : never
  }
}
