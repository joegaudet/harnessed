/**
 * `@harnessed-ts/should/register` without its global types: for a suite that
 * also uses Chai's should interface, whose types on functions and promises the
 * global `Function.should` and `Promise.should` would hide. Everything works at
 * runtime; only `harness.should` and `query.should` are typed, so assert on a
 * method's value with `expect`, or cast.
 */
import { registerHarnessWrapper, registerShould } from '@harnessed-ts/core'
import { targetAssertions, valueAssertions } from './assertions'
import { addTargetChecks, addValueChecks, shouldFor } from './chain'
import { wrapMembers } from './member'
import type { TargetAssertion } from './types'

addValueChecks(valueAssertions)
addTargetChecks(targetAssertions)
registerShould(shouldFor)
registerHarnessWrapper(wrapMembers)

declare module '@harnessed-ts/core' {
  interface ScopedHarness {
    /** Asserts on this harness's host. Every terminal returns a promise: await it. */
    readonly should: TargetAssertion
  }
  interface Query {
    /** Asserts on this target. Every terminal returns a promise: await it. */
    readonly should: TargetAssertion
  }
}
