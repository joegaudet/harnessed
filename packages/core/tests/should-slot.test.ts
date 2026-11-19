import { afterEach, describe, expect, it } from 'vitest'
import {
  applyConfig,
  getConfig,
  Query,
  registerShould,
  resetConfig,
  ScopedHarness,
} from '../src/index'
import { globals } from '../src/globals'

/** Reads `should` off `prototype` for `subject`, as an instance would. */
function readShould(prototype: object, subject: object): unknown {
  return Object.getOwnPropertyDescriptor(prototype, 'should')?.get?.call(subject)
}

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
    expect(() => readShould(ScopedHarness.prototype, {})).toThrow(/@harnessed-ts\/should\/register/)
  })

  it('hands the harness or query to the registered factory', () => {
    registerShould(subject => ({ subject }))
    const subject = {}
    expect(readShould(ScopedHarness.prototype, subject)).toEqual({ subject })
    expect(readShould(Query.prototype, subject)).toEqual({ subject })
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
