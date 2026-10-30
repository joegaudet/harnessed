import { harnessMatchers } from '@harnessed-ts/core'
import type { Assertable } from '@harnessed-ts/core'
import { mockMatchers } from '@harnessed-ts/mock'
import type { RequestExpectation, Requested } from '@harnessed-ts/mock'
import { expect } from '@playwright/test'

// Registering on import is the point: `import '@harnessed-ts/playwright/matchers'`
// in a fixture or setup file is all a suite needs.
expect.extend(harnessMatchers)
expect.extend(mockMatchers)

// Playwright's augmentation point is this global namespace, not the module.
declare global {
  namespace PlaywrightTest {
    // The parameter list must match Playwright's own declaration exactly. `T` is
    // the subject, and gating on it means calling these on something that is not
    // a target or a harness is a type error rather than a runtime surprise.
    interface Matchers<R, T = unknown> {
      toBeSelected(): T extends Assertable ? R : never
      toBeAbsent(): T extends Assertable ? R : never
      toReadAs(expected: string | RegExp): T extends Assertable ? R : never
      toHaveBeenRequested(): T extends Requested ? R : never
      toHaveBeenRequestedTimes(times: number): T extends Requested ? R : never
      toHaveBeenRequestedWith(expected: RequestExpectation): T extends Requested ? R : never
    }
  }
}
