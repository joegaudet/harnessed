import { afterEach, describe, expect, it } from 'vitest'
import '../src/bdd/register'
import { failure, FULL_FORM, show } from './helpers'

/**
 * Chai's BDD vocabulary, ported from Chai 6's `expect` tests to terminal calls:
 * `.ok` becomes `.ok()`. Each case asserts a pass, a negation, and a failure
 * message, so parity is checked rather than claimed.
 */
afterEach(() => {
  document.body.innerHTML = ''
})

describe('bdd: truthiness and existence', () => {
  it('ok, exist', async () => {
    const form = show(FULL_FORM)
    await form.should.error.be.ok()
    await form.should.missing.not.be.ok()
    await form.should.error.exist()
    expect(await failure(() => form.should.missing.be.ok())).toBe(
      'expected FormHarness.missing() to be ok, but it was undefined',
    )
    await show('').should.error.not.exist()
  })

  it('empty', async () => {
    const form = show(FULL_FORM)
    await form.should.tags.not.be.empty()
    await form.should.cell(0, '').not.be.empty()
    expect(await failure(() => form.should.tags.be.empty())).toBe(
      'expected FormHarness.tags() to be empty, but it was ["admin","editor"]',
    )
  })
})

describe('bdd: types', () => {
  it('a, an and instanceOf', async () => {
    const form = show(FULL_FORM)
    await form.should.error.be.a('string')
    await form.should.tags.be.an('array')
    await form.should.profile.be.an('object')
    await form.should.tags.be.instanceOf(Array)
    await form.should.tags.be.an.instanceof(Array)
    expect(await failure(() => form.should.attempts.be.a('string'))).toBe(
      'expected FormHarness.attempts() to be a string, but it was 3',
    )
    await show('').should.error.be.a('null')
  })

  it('NaN and finite', async () => {
    const form = show(FULL_FORM)
    await form.should.attempts.be.finite()
    await form.should.attempts.not.be.NaN()
  })
})

describe('bdd: properties and keys', () => {
  it('property and ownProperty, with and without a value', async () => {
    const form = show(FULL_FORM)
    await form.should.profile.have.property('name')
    await form.should.profile.have.property('name', 'Ada')
    await form.should.profile.not.have.property('name', 'Grace')
    await form.should.profile.have.deep.property('roles', ['admin', 'editor'])
    await form.should.profile.have.ownProperty('roles')
    await form.should.profile.not.have.ownProperty('toString')
    expect(await failure(() => form.should.profile.have.property('age'))).toBe(
      'expected FormHarness.profile() to have property "age", but it was {"name":"Ada","roles":["admin","editor"]}',
    )
  })

  it('keys: exactly these, as a list or arguments', async () => {
    const form = show(FULL_FORM)
    await form.should.profile.have.keys('name', 'roles')
    await form.should.profile.have.keys(['roles', 'name'])
    await form.should.profile.not.have.keys('name')
  })
})

describe('bdd: collections', () => {
  it('members ignores order; oneOf finds the value in a list', async () => {
    const form = show(FULL_FORM)
    await form.should.tags.have.members(['editor', 'admin'])
    await form.should.tags.not.have.members(['admin'])
    await form.should.error.be.oneOf(['Bad credentials', 'Locked out'])
    expect(await failure(() => form.should.error.be.oneOf(['Locked out']))).toBe(
      'expected FormHarness.error() to be one of ["Locked out"], but it was "Bad credentials"',
    )
  })

  it('string', async () => {
    const form = show(FULL_FORM)
    await form.should.error.have.string('credentials')
    await form.should.error.not.have.string('Welcome')
  })
})

describe('bdd: numbers', () => {
  it('least, most, within and closeTo', async () => {
    const form = show(FULL_FORM)
    await form.should.attempts.be.at.least(3)
    await form.should.attempts.be.gte(3)
    await form.should.attempts.be.at.most(3)
    await form.should.attempts.be.lte(3)
    await form.should.attempts.be.within(1, 5)
    await form.should.attempts.be.closeTo(3.1, 0.2)
    await form.should.attempts.be.approximately(2.9, 0.2)
    expect(await failure(() => form.should.attempts.be.within(4, 5))).toBe(
      'expected FormHarness.attempts() to be within 4..5, but it was 3',
    )
  })
})

describe('bdd: predicates and object state', () => {
  it('satisfy', async () => {
    const form = show(FULL_FORM)
    await form.should.attempts.satisfy((n: number) => n % 2 === 1)
    expect(await failure(() => form.should.attempts.satisfy((n: number) => n > 5))).toMatch(
      /to satisfy the predicate/,
    )
  })

  it('frozen, sealed and extensible', async () => {
    const form = show(FULL_FORM)
    await form.should.profile.be.extensible()
    await form.should.profile.not.be.frozen()
    await form.should.profile.not.be.sealed()
  })
})

describe('bdd: rejection', () => {
  it('rejected and rejectedWith a message, a pattern or a class', async () => {
    const form = show(FULL_FORM)
    await form.should.explode.be.rejected()
    await form.should.explode.be.rejectedWith('blew up')
    await form.should.explode.be.rejectedWith(/blew/)
    await form.should.explode.be.rejectedWith(Error)
    await form.should.error.not.be.rejected()
    expect(await failure(() => form.should.error.be.rejected())).toBe(
      'expected FormHarness.error() to be rejected, but it resolved "Bad credentials"',
    )
    expect(await failure(() => form.should.explode.be.rejectedWith(/locked/))).toBe(
      'expected FormHarness.explode() to be rejected with /locked/, but it rejected with Error: the form blew up',
    )
  })
})

describe('bdd keeps the core vocabulary', () => {
  it('null, equal and the harness matchers still work', async () => {
    const form = show(FULL_FORM)
    await form.should.error.not.be.null()
    await form.should.attempts.equal(3)
    await form.errorLine.should.readAs('Bad credentials')
  })
})
