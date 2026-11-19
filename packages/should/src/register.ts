/**
 * Import once, from your test setup file, to give every harness and query a
 * `should`:
 *
 * ```ts
 * import '@harnessed-ts/should/register'
 *
 * await form.should.error.be.null()
 * await form.submitButton.should.be.absent()
 * ```
 */
import { registerShould } from '@harnessed-ts/core'
import { targetAssertions, valueAssertions } from './assertions'
import { addTargetChecks, addValueChecks, shouldFor } from './chain'
import type { HarnessShould, TargetAssertion } from './types'

addValueChecks(valueAssertions)
addTargetChecks(targetAssertions)
registerShould(shouldFor)

declare module '@harnessed-ts/core' {
  interface ScopedHarness {
    /** Asserts on this harness's methods and targets. Every terminal returns a promise: await it. */
    readonly should: HarnessShould<this>
  }
  interface Query {
    /** Asserts on this target. Every terminal returns a promise: await it. */
    readonly should: TargetAssertion
  }
}
