import { describe, expectTypeOf, it } from 'vitest'
import '../src/register'
import type { TargetAssertion, ValueAssertion } from '../src/index'
import { show } from './helpers'

/**
 * These assertions run at compile time (`pnpm typecheck:tools`): each
 * `@ts-expect-error` must be an error, or the build fails. The bodies are
 * handed to `compileOnly` and never run.
 */
function compileOnly(_body: () => void): void {}

describe('should types', () => {
  it('maps async methods to value chains typed by what they resolve to', () => {
    compileOnly(() => {
      const form = show('')
      expectTypeOf(form.should.error).toMatchTypeOf<ValueAssertion<string | null>>()
      expectTypeOf(form.should.error.be.null()).toEqualTypeOf<Promise<void>>()
      expectTypeOf(form.should.attempts.not.equal).parameter(0).toEqualTypeOf<number>()
      expectTypeOf(form.should.cell(1, 'a')).toMatchTypeOf<ValueAssertion<string>>()
    })
  })

  it('maps targets to target chains, on the harness, a field and a query', () => {
    compileOnly(() => {
      const form = show('')
      expectTypeOf(form.should.errorLine).toEqualTypeOf<TargetAssertion>()
      expectTypeOf(form.errorLine.should).toEqualTypeOf<TargetAssertion>()
      expectTypeOf(form.should.be.absent()).toEqualTypeOf<Promise<void>>()
    })
  })

  it('rejects what cannot be asserted on', () => {
    compileOnly(() => {
      const form = show('')
      // @ts-expect-error — a typo is caught at compile time
      void form.should.eror
      // @ts-expect-error — an action resolves nothing, and under retry would run again
      void form.should.submitIt
      // @ts-expect-error — a plain field is not read through a driver
      void form.should.calls
      // @ts-expect-error — internal plumbing is not an assertion subject
      void form.should._env
      // @ts-expect-error — a method that needs arguments must be called first
      void form.should.cell.equal('x')
      // @ts-expect-error — the expected value has the method's type
      void form.should.attempts.equal('3')
      // @ts-expect-error — terminals are calls
      void form.should.error.be.null.then
    })
  })
})
