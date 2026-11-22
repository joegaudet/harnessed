/**
 * The global types behind `form.error.should` and `form.error().should`.
 * `@harnessed-ts/should/register` imports them; `register-scoped` leaves them out.
 */
import type { Unchecked, ValueAssertion } from './types'

declare global {
  interface Promise<T> {
    /**
     * On what a harness method returned: asserts on what it resolves to, calling
     * the method again on a retry. Every terminal returns a promise: await it.
     * Not conditional on `T`, so `Promise` stays covariant: a conditional here
     * stops `Promise<void>` being a `Promise<unknown>` across the whole program.
     */
    readonly should: ValueAssertion<Awaited<T>>
  }
  interface Function {
    /**
     * On a harness method: asserts on what it resolves to when called with no
     * arguments. TypeScript cannot see the method's type from here, so the
     * expected value is unchecked; `method().should` checks it.
     */
    readonly should: ValueAssertion<Unchecked>
  }
}
