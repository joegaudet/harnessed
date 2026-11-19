import { createRequire } from 'node:module'
import { configure, harnessMatchers, Query, resetConfig } from '@harnessed-ts/core'
import type * as Core from '@harnessed-ts/core'
import { afterEach, describe, expect, it } from 'vitest'
import '../src/register'
import { AssertionError } from '../src/index'
import type { TargetAssertion } from '../src/index'
import { clearError, failure, FULL_FORM, show } from './helpers'

afterEach(() => {
  document.body.innerHTML = ''
  resetConfig()
})

describe('value assertions on a harness method', () => {
  it('null: passes on null, fails naming the method and what it read', async () => {
    const form = show(FULL_FORM)
    await form.should.error.not.be.null()
    expect(await failure(() => form.should.error.be.null())).toBe(
      'expected FormHarness.error() to be null, but it was "Bad credentials"',
    )
    const empty = show('')
    await empty.should.error.be.null()
    expect(await failure(() => empty.should.error.not.be.null())).toBe(
      'expected FormHarness.error() not to be null',
    )
  })

  it('true, false and undefined', async () => {
    const form = show(FULL_FORM)
    await form.should.hasError.be.true()
    await form.should.hasError.not.be.false()
    await form.should.missing.be.undefined()
    expect(await failure(() => form.should.hasError.be.false())).toBe(
      'expected FormHarness.hasError() to be false, but it was true',
    )
  })

  it('equal is strict; deep.equal and eql compare structure', async () => {
    const form = show(FULL_FORM)
    await form.should.attempts.equal(3)
    await form.should.attempts.equals(3)
    expect(await failure(() => form.should.attempts.equal(4))).toBe(
      'expected FormHarness.attempts() to equal 4, but it was 3',
    )
    expect(await failure(() => form.should.tags.equal(['admin', 'editor']))).toMatch(/to equal/)
    await form.should.tags.deep.equal(['admin', 'editor'])
    await form.should.profile.eql({ name: 'Ada', roles: ['admin', 'editor'] })
    await form.should.profile.not.eql({ name: 'Ada', roles: ['admin'] })
  })

  it('match, include and contain', async () => {
    const form = show(FULL_FORM)
    await form.should.error.match(/credentials/)
    await form.should.error.include('Bad')
    await form.should.tags.include('admin')
    await form.should.tags.not.contain('owner')
    await form.should.profile.include({ name: 'Ada' })
    expect(await failure(() => form.should.tags.include('owner'))).toBe(
      'expected FormHarness.tags() to include "owner", but it was ["admin","editor"]',
    )
  })

  it('above, below and length', async () => {
    const form = show(FULL_FORM)
    await form.should.attempts.be.above(2)
    await form.should.attempts.be.below(4)
    await form.should.tags.have.length(2)
    await form.should.tags.have.lengthOf(2)
    expect(await failure(() => form.should.attempts.be.above(3))).toBe(
      'expected FormHarness.attempts() to be above 3, but it was 3',
    )
  })

  it('calls a method that takes arguments', async () => {
    const form = show(FULL_FORM)
    await form.should.cell(2, 'name').equal('2:name')
    expect(await failure(() => form.should.cell(2, 'name').equal('x'))).toBe(
      'expected FormHarness.cell(2, "name") to equal "x", but it was "2:name"',
    )
  })

  it('reads the method afresh at the terminal, not when the chain is built', async () => {
    const form = show(FULL_FORM)
    const pending = form.should.error
    expect(form.calls).toBe(0)
    clearError()
    await pending.be.null()
    expect(form.calls).toBe(1)
  })

  it('lets an error from the method through', async () => {
    const form = show(FULL_FORM)
    await expect(form.should.explode.equal('x')).rejects.toThrow('the form blew up')
  })
})

describe('harness matchers', () => {
  it('absent, on a query field and on a query', async () => {
    const form = show('')
    await form.should.errorLine.be.absent()
    await form.errorLine.should.be.absent()
    const full = show(FULL_FORM)
    expect(await failure(() => full.errorLine.should.be.absent())).toBe(
      (await harnessMatchers.toBeAbsent(full.errorLine)).message(),
    )
  })

  it('absent and not absent on the harness itself', async () => {
    await show('').should.not.be.absent()
    const gone = show('')
    document.body.innerHTML = ''
    await gone.should.be.absent()
  })

  it('selected and readAs share core messages', async () => {
    const form = show(FULL_FORM)
    await form.submitButton.should.be.selected()
    await form.errorLine.should.readAs('Bad credentials')
    await form.should.errorLine.readAs(/credentials/)
    expect(await failure(() => form.errorLine.should.readAs('Welcome'))).toBe(
      (await harnessMatchers.toReadAs(form.errorLine, 'Welcome')).message(),
    )
    expect(await failure(() => form.submitButton.should.not.be.selected())).toBe(
      (await harnessMatchers.toBeSelected(form.submitButton)).message(),
    )
  })

  it('has a should form for every core matcher', () => {
    const form = show(FULL_FORM)
    const names = { toBeAbsent: 'absent', toBeSelected: 'selected', toReadAs: 'readAs' }
    expect(Object.keys(harnessMatchers).sort()).toEqual(Object.keys(names).sort())
    for (const name of Object.values(names)) {
      expect(typeof Reflect.get(form.errorLine.should, name)).toBe('function')
    }
  })
})

describe('the assertion error', () => {
  it('carries actual and expected, and no diff for a failed negation', async () => {
    const form = show(FULL_FORM)
    const plain = await form.should.attempts.equal(4).catch((error: unknown) => error)
    expect(plain).toBeInstanceOf(AssertionError)
    expect(plain).toMatchObject({ actual: 3, expected: 4, showDiff: true })
    const negated = await form.should.attempts.not.equal(3).catch((error: unknown) => error)
    expect(negated).toMatchObject({ actual: 3, expected: 3, showDiff: false })
  })
})

describe('mistakes', () => {
  it('names an assertion that does not exist', () => {
    const form = show(FULL_FORM)
    expect(() => Reflect.get(form.should.error, 'beNull')).toThrow(
      /"beNull" is not a should assertion/,
    )
  })

  it('refuses a member that is neither an async method nor a target', () => {
    const form = show(FULL_FORM)
    expect(() => Reflect.get(form.should, 'calls')).toThrow(
      /FormHarness\.calls is not an async method or a target/,
    )
  })

  it('is not thenable, so a forgotten terminal does not quietly pass', () => {
    const form = show(FULL_FORM)
    expect(Reflect.get(form.should.error, 'then')).toBeUndefined()
    expect(Reflect.get(form.should, 'then')).toBeUndefined()
  })

  it('prints its path', () => {
    const form = show(FULL_FORM)
    expect(String(form.should.error.not)).toBe('FormHarness.should.error.not')
  })
})

describe('retryAssertions', () => {
  it('retries until the assertion passes, calling the method each time', async () => {
    configure({ retryAssertions: true, defaultTimeout: 1_000 })
    const form = show(FULL_FORM)
    setTimeout(() => clearError(), 100)
    await form.should.error.be.null()
    expect(form.calls).toBeGreaterThan(1)
  })

  it('reports the last failure once the timeout runs out', async () => {
    configure({ retryAssertions: true, defaultTimeout: 200 })
    const form = show(FULL_FORM)
    const started = Date.now()
    expect(await failure(() => form.should.error.be.null())).toMatch(/to be null/)
    expect(Date.now() - started).toBeGreaterThanOrEqual(200)
  })

  it('retries a harness matcher too', async () => {
    configure({ retryAssertions: true, defaultTimeout: 1_000 })
    const form = show(FULL_FORM)
    setTimeout(() => clearError(), 100)
    await form.errorLine.should.be.absent()
  })

  it('retries through a method that throws, then rethrows the last error', async () => {
    configure({ retryAssertions: true, defaultTimeout: 200 })
    const form = show(FULL_FORM)
    await expect(form.should.explode.equal('x')).rejects.toThrow('the form blew up')
    expect(form.calls).toBeGreaterThan(1)
  })

  it('checks once when off', async () => {
    const form = show(FULL_FORM)
    setTimeout(() => clearError(), 50)
    await failure(() => form.should.error.be.null())
    expect(form.calls).toBe(1)
  })
})

describe('two copies of core', () => {
  it('gives a query built through the CJS copy a should, registered through the ESM one', async () => {
    const cjs = createRequire(import.meta.url)('@harnessed-ts/core') as typeof Core
    expect(cjs.Query).not.toBe(Query)
    const form = show('')
    const should: unknown = Object.getOwnPropertyDescriptor(
      cjs.Query.prototype,
      'should',
    )?.get?.call(form.errorLine)
    await (should as TargetAssertion).be.absent()
  })
})
