import { describe, expect, it } from 'vitest'
import { messageOf, toError } from '../src/errors'

describe('toError', () => {
  it('passes an Error through untouched', () => {
    const error = new Error('already one')
    expect(toError(error)).toBe(error)
  })

  it("restates an error the page raised in the page's own words", () => {
    const raised = { code: 'E4', errMsg: 'Error: harnessed: strict mode violation — 2 nodes match' }
    const error = toError(raised)
    expect(error.message).toBe('harnessed: strict mode violation — 2 nodes match')
    expect(error.cause).toBe(raised)
  })

  it.each([
    ['E24', /nothing matches it/],
    ['E26', /it is not visible/],
    ['E101', /another element covers it/],
    ['E31', /it is not editable/],
    ['E36', /TestCafe has no such key/],
    ['E84', /timed out/],
    ['E49', /page unloaded/],
  ])('says what TestCafe error %s means, and keeps the code and the cause', (code, reason) => {
    const failure = { code }
    const error = toError(failure, 'act on testId(ghost)')
    expect(error.message).toMatch(/^harnessed: TestCafe could not act on testId\(ghost\): /)
    expect(error.message).toMatch(reason)
    expect(error.message).toContain(`(TestCafe error ${code})`)
    expect(error.cause).toBe(failure)
  })

  it("adds TestCafe's own reason when it gives one", () => {
    const error = toError(
      { code: 'E26', reason: 'It has the visibility: hidden style.' },
      'act on testId(ghost)',
    )
    expect(error.message).toContain('it is not visible: It has the visibility: hidden style.')
  })

  it('keeps an unknown code rather than dropping it', () => {
    const error = toError({ code: 'E999' }, 'act on testId(ghost)')
    expect(error.message).toBe(
      'harnessed: TestCafe could not act on testId(ghost) (TestCafe error E999).',
    )
  })
})

describe('messageOf', () => {
  it('reads an Error and a TestCafe failure alike', () => {
    expect(messageOf(new Error('one'))).toBe('one')
    expect(messageOf({ errMsg: 'two' })).toBe('two')
    expect(messageOf(undefined)).toBe('')
  })
})
