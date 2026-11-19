import { afterEach, describe, expect, it } from 'vitest'
import {
  applyConfig,
  ComponentHarness,
  getConfig,
  Harness,
  Query,
  registerShould,
  resetConfig,
  testId,
} from '../src/index'
import { globals } from '../src/globals'

// Applied by hand: this package's tests run without a decorator transform.
class ProbeHarness extends ComponentHarness {}
Harness({ host: testId('probe') })(ProbeHarness, {} as ClassDecoratorContext)

const env = { driver: 'should-slot-probe' }

afterEach(() => {
  globals().should = undefined
  resetConfig()
})

/**
 * Core owns the `should` getter so that every copy of core (ESM and CJS) has
 * one; `@harnessed-ts/should/register` only fills the shared slot it reads.
 */
describe('should slot', () => {
  it('refuses, naming the import, before anything is registered', () => {
    const probe = new ProbeHarness(env)
    expect(() => (probe as unknown as { should: unknown }).should).toThrow(
      /@harnessed-ts\/should\/register/,
    )
  })

  it('hands the harness to the registered factory', () => {
    registerShould(subject => ({ subject }))
    const probe = new ProbeHarness(env)
    expect((probe as unknown as { should: { subject: unknown } }).should.subject).toBe(probe)
  })

  it('defines the getter on Query too, without making it enumerable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Query.prototype, 'should')
    expect(descriptor?.get).toBeTypeOf('function')
    expect(descriptor?.enumerable).toBe(false)
  })

  it('does not retry assertions unless configured to', () => {
    expect(getConfig().retryAssertions).toBe(false)
    applyConfig({ retryAssertions: true })
    expect(getConfig().retryAssertions).toBe(true)
  })
})
