import { describe, expectTypeOf, it } from 'vitest'
import '../src/register'
import type { TargetAssertion, Unchecked, ValueAssertion } from '../src/index'
import { show } from './helpers'

/**
 * These assertions run at compile time (`pnpm typecheck:tools`): each
 * `@ts-expect-error` must be an error, or the build fails. The bodies are
 * handed to `compileOnly` and never run.
 */
function compileOnly(_body: () => void): void {}

describe('should types', () => {
  it('types a called method by what it resolves to', () => {
    compileOnly(() => {
      const form = show('')
      expectTypeOf(form.error().should).toEqualTypeOf<ValueAssertion<string | null>>()
      expectTypeOf(form.error().should.be.null()).toEqualTypeOf<Promise<void>>()
      expectTypeOf(form.attempts().should.not.equal).parameter(0).toEqualTypeOf<number>()
      expectTypeOf(form.cell(1, 'a').should).toEqualTypeOf<ValueAssertion<string>>()
    })
  })

  it('gives an uncalled method a loosely typed chain', () => {
    compileOnly(() => {
      const form = show('')
      expectTypeOf(form.error.should).toEqualTypeOf<ValueAssertion<Unchecked>>()
      expectTypeOf(form.error.should.be.null()).toEqualTypeOf<Promise<void>>()
    })
  })

  it('maps targets to target chains, on the harness, a field and a query', () => {
    compileOnly(() => {
      const form = show('')
      expectTypeOf(form.errorLine.should).toEqualTypeOf<TargetAssertion>()
      expectTypeOf(form.should).toEqualTypeOf<TargetAssertion>()
      expectTypeOf(form.should.be.absent()).toEqualTypeOf<Promise<void>>()
    })
  })

  it('rejects what cannot be asserted on', () => {
    compileOnly(() => {
      const form = show('')
      // @ts-expect-error — members are not looked up on the harness should
      void form.should.error
      // @ts-expect-error — the expected value has the method's type
      void form.attempts().should.equal('3')
      // @ts-expect-error — terminals are calls
      void form.error().should.be.null.then
    })
  })
})
