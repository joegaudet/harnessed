import { afterEach, describe, expect, it } from 'vitest'
import {
  applyConfig,
  ComponentHarness,
  getConfig,
  Harness,
  testId,
  Query,
  registerHarnessWrapper,
  registerShould,
  resetConfig,
  ScopedHarness,
} from '../src/index'
import type { EnvConfig } from '../src/env'
import { globals } from '../src/globals'

class Form extends ComponentHarness {}
// Applied by hand: these tests run without a decorator transform.
Harness({ host: testId('form') })(Form, {} as ClassDecoratorContext)

/** Reads `should` off `prototype` for `subject`, as an instance would. */
function readShould(prototype: object, subject: object): unknown {
  return Object.getOwnPropertyDescriptor(prototype, 'should')?.get?.call(subject)
}

afterEach(() => {
  globals().should = undefined
  globals().wrapHarness = undefined
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

  it("steps aside for an inherited should, such as chai.should()'s, until one is registered", () => {
    Object.defineProperty(Object.prototype, 'should', {
      configurable: true,
      get(this: object) {
        return { chai: this }
      },
    })
    try {
      const subject = {}
      expect(readShould(Query.prototype, subject)).toEqual({ chai: subject })
      registerShould(registered => ({ registered }))
      expect(readShould(Query.prototype, subject)).toEqual({ registered: subject })
    } finally {
      delete (Object.prototype as { should?: unknown }).should
    }
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

  it('builds a harness as itself until a wrapper is registered, then as what the wrapper returns', () => {
    const plain = new Form({} as EnvConfig)
    expect(Object.getPrototypeOf(plain)).toBe(Form.prototype)
    const wrapped: object[] = []
    registerHarnessWrapper(harness => {
      const proxy = new Proxy(harness, {})
      wrapped.push(proxy)
      return proxy
    })
    const form = new Form({} as EnvConfig)
    expect(wrapped).toEqual([form])
    expect(wrapped[0]).toBe(form)
    expect(form).toBeInstanceOf(Form)
  })
})
