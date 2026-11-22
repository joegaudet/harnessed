import { createRequire } from 'node:module'
import { configure, harnessMatchers, Query, resetConfig } from '@harnessed-ts/core'
import type * as Core from '@harnessed-ts/core'
import { afterEach, describe, expect, it } from 'vitest'
import '../src/register'
import { AssertionError } from '../src/index'
import type { TargetAssertion } from '../src/index'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import { clearError, failure, FormHarness, FULL_FORM, show } from './helpers'

afterEach(() => {
  document.body.innerHTML = ''
  resetConfig()
})

describe('value assertions on a harness method', () => {
  it('null: passes on null, fails naming the method and what it read', async () => {
    const form = show(FULL_FORM)
    await form.error.should.not.be.null()
    expect(await failure(() => form.error.should.be.null())).toBe(
      'expected FormHarness.error() to be null, but it was "Bad credentials"',
    )
    const empty = show('')
    await empty.error.should.be.null()
    expect(await failure(() => empty.error.should.not.be.null())).toBe(
      'expected FormHarness.error() not to be null',
    )
  })

  it('true, false and undefined', async () => {
    const form = show(FULL_FORM)
    await form.hasError.should.be.true()
    await form.hasError.should.not.be.false()
    await form.missing.should.be.undefined()
    expect(await failure(() => form.hasError.should.be.false())).toBe(
      'expected FormHarness.hasError() to be false, but it was true',
    )
  })

  it('equal is strict; deep.equal and eql compare structure', async () => {
    const form = show(FULL_FORM)
    await form.attempts.should.equal(3)
    await form.attempts.should.equals(3)
    expect(await failure(() => form.attempts.should.equal(4))).toBe(
      'expected FormHarness.attempts() to equal 4, but it was 3',
    )
    expect(await failure(() => form.tags.should.equal(['admin', 'editor']))).toMatch(/to equal/)
    await form.tags.should.deep.equal(['admin', 'editor'])
    await form.profile.should.eql({ name: 'Ada', roles: ['admin', 'editor'] })
    await form.profile.should.not.eql({ name: 'Ada', roles: ['admin'] })
  })

  it('match, include and contain', async () => {
    const form = show(FULL_FORM)
    await form.error.should.match(/credentials/)
    await form.error.should.include('Bad')
    await form.tags.should.include('admin')
    await form.tags.should.not.contain('owner')
    await form.profile.should.include({ name: 'Ada' })
    expect(await failure(() => form.tags.should.include('owner'))).toBe(
      'expected FormHarness.tags() to include "owner", but it was ["admin","editor"]',
    )
  })

  it('above, below and length', async () => {
    const form = show(FULL_FORM)
    await form.attempts.should.be.above(2)
    await form.attempts.should.be.below(4)
    await form.tags.should.have.length(2)
    await form.tags.should.have.lengthOf(2)
    expect(await failure(() => form.attempts.should.be.above(3))).toBe(
      'expected FormHarness.attempts() to be above 3, but it was 3',
    )
  })

  it('calls a method that takes arguments', async () => {
    const form = show(FULL_FORM)
    await form.cell(2, 'name').should.equal('2:name')
    expect(await failure(() => form.cell(2, 'name').should.equal('x'))).toBe(
      'expected FormHarness.cell(2, "name") to equal "x", but it was "2:name"',
    )
  })

  it('reads the method afresh at the terminal, not when the chain is built', async () => {
    const form = show(FULL_FORM)
    const pending = form.error.should
    expect(form.calls).toBe(0)
    clearError()
    await pending.be.null()
    expect(form.calls).toBe(1)
  })

  it('lets an error from the method through', async () => {
    const form = show(FULL_FORM)
    await expect(form.explode.should.equal('x')).rejects.toThrow('the form blew up')
    await expect(form.explode().should.equal('x')).rejects.toThrow('the form blew up')
  })
})

describe('should on a called method', () => {
  it('asserts on what the call resolves to, with the same messages', async () => {
    const form = show(FULL_FORM)
    await form.error().should.not.be.null()
    await form.attempts().should.equal(3)
    expect(await failure(() => form.error().should.be.null())).toBe(
      'expected FormHarness.error() to be null, but it was "Bad credentials"',
    )
  })

  it('reuses the call it was read from, so a pass calls the method once', async () => {
    const form = show(FULL_FORM)
    await form.error().should.match(/credentials/)
    expect(form.calls).toBe(1)
  })

  it('is still the promise the method returned', async () => {
    const form = show(FULL_FORM)
    const reading = form.error()
    expect(reading).toBeInstanceOf(Promise)
    expect(await reading).toBe('Bad credentials')
    expect(Object.keys(reading)).toEqual([])
  })

  it('prints its path with the arguments', () => {
    const form = show(FULL_FORM)
    expect(String(form.cell(2, 'name').should.not)).toBe('FormHarness.cell(2, "name").should.not')
  })
})

describe('the harness behind should', () => {
  it('hands out one wrapper per method, still bound to the harness', async () => {
    const form = show(FULL_FORM)
    expect(form.error).toBe(form.error)
    const { attempts } = form
    expect(await attempts()).toBe(3)
  })

  it('keeps private fields and getters on a subclass working', async () => {
    class Secretive extends FormHarness {
      #secret = 'hidden'
      get secret(): string {
        return this.#secret
      }
      async reveal(): Promise<string> {
        return this.#secret
      }
    }
    const form = new Secretive(dom({ user: userEvent.setup() }))
    expect(form.secret).toBe('hidden')
    await form.reveal.should.equal('hidden')
    await form.reveal().should.equal('hidden')
  })

  it('gives child harnesses the same should', async () => {
    const form = show(FULL_FORM)
    await form.counter.value.should.equal(3)
  })

  it('asserts on a member named like a chain word', async () => {
    const form = show(FULL_FORM)
    await form.has('admin').should.be.true()
  })

  it('leaves a sync method returning what it returns', () => {
    const form = show(FULL_FORM)
    expect(form.label()).toBe('form')
  })

  it('leaves plumbing alone', () => {
    const form = show(FULL_FORM)
    expect(Reflect.get(form, 'elementBy')).toBe(Reflect.get(FormHarness.prototype, 'elementBy'))
  })
})

describe('harness matchers', () => {
  it('absent, on a query field and on a query', async () => {
    const form = show('')
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
    await form.errorLine.should.readAs(/credentials/)
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
    const plain = await form.attempts.should.equal(4).catch((error: unknown) => error)
    expect(plain).toBeInstanceOf(AssertionError)
    expect(plain).toMatchObject({ actual: 3, expected: 4, showDiff: true })
    const negated = await form.attempts.should.not.equal(3).catch((error: unknown) => error)
    expect(negated).toMatchObject({ actual: 3, expected: 3, showDiff: false })
  })
})

describe('mistakes', () => {
  it('names an assertion that does not exist', () => {
    const form = show(FULL_FORM)
    expect(() => Reflect.get(form.error.should, 'beNull')).toThrow(
      /"beNull" is not a should assertion/,
    )
  })

  it('no longer looks members up on the harness should: should follows the member', () => {
    const form = show(FULL_FORM)
    expect(() => Reflect.get(form.should, 'error')).toThrow(/"error" is not a should assertion/)
  })

  it('is not thenable, so a forgotten terminal does not quietly pass', () => {
    const form = show(FULL_FORM)
    expect(Reflect.get(form.error.should, 'then')).toBeUndefined()
    expect(Reflect.get(form.should, 'then')).toBeUndefined()
  })

  it('rejects a terminal awaited without its call, naming the fix', async () => {
    const form = show(FULL_FORM)
    await expect(Promise.resolve(Reflect.get(form.error.should.be, 'null'))).rejects.toThrow(
      /`\.null` is a call: write `\.null\(\)`/,
    )
    await expect(Promise.resolve(Reflect.get(form.should.be, 'absent'))).rejects.toThrow(
      /`\.absent` is a call/,
    )
  })

  it('refuses a call on a word', () => {
    const form = show(FULL_FORM)
    const be: unknown = Reflect.get(form.error.should, 'be')
    expect(() => (be as () => unknown)()).toThrow(/"be" is not a call/)
  })

  it('prints its path', () => {
    const form = show(FULL_FORM)
    expect(String(form.error.should.not)).toBe('FormHarness.error.should.not')
  })
})

describe('retryAssertions', () => {
  it('retries until the assertion passes, calling the method each time', async () => {
    configure({ retryAssertions: true, defaultTimeout: 1_000 })
    const form = show(FULL_FORM)
    setTimeout(() => clearError(), 100)
    await form.error.should.be.null()
    expect(form.calls).toBeGreaterThan(1)
  })

  it('reports the last failure once the timeout runs out', async () => {
    configure({ retryAssertions: true, defaultTimeout: 200 })
    const form = show(FULL_FORM)
    const started = Date.now()
    expect(await failure(() => form.error.should.be.null())).toMatch(/to be null/)
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
    await expect(form.explode.should.equal('x')).rejects.toThrow('the form blew up')
    expect(form.calls).toBeGreaterThan(1)
  })

  it('retries a called method with its arguments', async () => {
    configure({ retryAssertions: true, defaultTimeout: 1_000 })
    const form = show(FULL_FORM)
    let reads = 0
    const original = form.cell.bind(form)
    Object.defineProperty(form, 'cell', {
      configurable: true,
      value: async (row: number, column: string) =>
        ++reads > 2 ? original(row, column) : 'not yet',
    })
    await form.cell(2, 'name').should.equal('2:name')
    expect(reads).toBe(3)
  })

  it('checks once when off', async () => {
    const form = show(FULL_FORM)
    setTimeout(() => clearError(), 50)
    await failure(() => form.error.should.be.null())
    expect(form.calls).toBe(1)
  })
})

describe('two copies of should', () => {
  it('shares one vocabulary: the CJS register after the ESM bdd register keeps bdd', async () => {
    await import('../src/bdd/register')
    // The built CJS copy: a second module instance. `pnpm build` must run first.
    createRequire(import.meta.url)('../dist/register.cjs')
    const form = show(FULL_FORM)
    await Reflect.get(form.attempts.should.be, 'within')(1, 5)
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
