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
    await form.error.should.be.ok()
    await form.missing.should.not.be.ok()
    await form.error.should.exist()
    expect(await failure(() => form.missing.should.be.ok())).toBe(
      'expected FormHarness.missing() to be ok, but it was undefined',
    )
    await show('').error.should.not.exist()
  })

  it('empty', async () => {
    const form = show(FULL_FORM)
    await form.tags.should.not.be.empty()
    await form.cell(0, '').should.not.be.empty()
    expect(await failure(() => form.tags.should.be.empty())).toBe(
      'expected FormHarness.tags() to be empty, but it was ["admin","editor"]',
    )
  })
})

describe('bdd: types', () => {
  it('a, an and instanceOf', async () => {
    const form = show(FULL_FORM)
    await form.error.should.be.a('string')
    await form.tags.should.be.an('array')
    await form.profile.should.be.an('object')
    await form.tags.should.be.instanceOf(Array)
    await form.tags.should.be.an.instanceof(Array)
    expect(await failure(() => form.attempts.should.be.a('string'))).toBe(
      'expected FormHarness.attempts() to be a string, but it was 3',
    )
    await show('').error.should.be.a('null')
  })

  it('NaN and finite', async () => {
    const form = show(FULL_FORM)
    await form.attempts.should.be.finite()
    await form.attempts.should.not.be.NaN()
  })
})

describe('bdd: properties and keys', () => {
  it('property and ownProperty, with and without a value', async () => {
    const form = show(FULL_FORM)
    await form.profile.should.have.property('name')
    await form.profile.should.have.property('name', 'Ada')
    await form.profile.should.not.have.property('name', 'Grace')
    await form.profile.should.have.deep.property('roles', ['admin', 'editor'])
    await form.profile.should.have.ownProperty('roles')
    await form.profile.should.not.have.ownProperty('toString')
    expect(await failure(() => form.profile.should.have.property('age'))).toBe(
      'expected FormHarness.profile() to have property "age", but it was {"name":"Ada","roles":["admin","editor"]}',
    )
  })

  it('keys: exactly these, as a list or arguments', async () => {
    const form = show(FULL_FORM)
    await form.profile.should.have.keys('name', 'roles')
    await form.profile.should.have.keys(['roles', 'name'])
    await form.profile.should.not.have.keys('name')
  })
})

describe('bdd: collections', () => {
  it('members ignores order; oneOf finds the value in a list', async () => {
    const form = show(FULL_FORM)
    await form.tags.should.have.members(['editor', 'admin'])
    await form.tags.should.not.have.members(['admin'])
    await form.error.should.be.oneOf(['Bad credentials', 'Locked out'])
    expect(await failure(() => form.error.should.be.oneOf(['Locked out']))).toBe(
      'expected FormHarness.error() to be one of ["Locked out"], but it was "Bad credentials"',
    )
  })

  it('string', async () => {
    const form = show(FULL_FORM)
    await form.error.should.have.string('credentials')
    await form.error.should.not.have.string('Welcome')
  })
})

describe('bdd: numbers', () => {
  it('least, most, within and closeTo', async () => {
    const form = show(FULL_FORM)
    await form.attempts.should.be.at.least(3)
    await form.attempts.should.be.gte(3)
    await form.attempts.should.be.at.most(3)
    await form.attempts.should.be.lte(3)
    await form.attempts.should.be.within(1, 5)
    await form.attempts.should.be.closeTo(3.1, 0.2)
    await form.attempts.should.be.approximately(2.9, 0.2)
    expect(await failure(() => form.attempts.should.be.within(4, 5))).toBe(
      'expected FormHarness.attempts() to be within 4..5, but it was 3',
    )
  })
})

describe('bdd: predicates and object state', () => {
  it('satisfy', async () => {
    const form = show(FULL_FORM)
    await form.attempts().should.satisfy((n: number) => n % 2 === 1)
    expect(await failure(() => form.attempts().should.satisfy((n: number) => n > 5))).toMatch(
      /to satisfy the predicate/,
    )
  })

  it('frozen, sealed and extensible', async () => {
    const form = show(FULL_FORM)
    await form.profile.should.be.extensible()
    await form.profile.should.not.be.frozen()
    await form.profile.should.not.be.sealed()
  })
})

describe('bdd: rejection', () => {
  it('rejected and rejectedWith a message, a pattern or a class', async () => {
    const form = show(FULL_FORM)
    await form.explode.should.be.rejected()
    await form.explode.should.be.rejectedWith('blew up')
    await form.explode.should.be.rejectedWith(/blew/)
    await form.explode.should.be.rejectedWith(Error)
    await form.error.should.not.be.rejected()
    expect(await failure(() => form.error.should.be.rejected())).toBe(
      'expected FormHarness.error() to be rejected, but it resolved "Bad credentials"',
    )
    expect(await failure(() => form.explode.should.be.rejectedWith(/locked/))).toBe(
      'expected FormHarness.explode() to be rejected with /locked/, but it rejected with Error: the form blew up',
    )
  })
})

describe('bdd keeps the core vocabulary', () => {
  it('null, equal and the harness matchers still work', async () => {
    const form = show(FULL_FORM)
    await form.error.should.not.be.null()
    await form.attempts.should.equal(3)
    await form.errorLine.should.readAs('Bad credentials')
  })
})
