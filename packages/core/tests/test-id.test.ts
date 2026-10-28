import { describe, expect, it } from 'vitest'
import { checkFileTarget, testId, testIdPresenceSelector } from '../src/index'

describe('testIdPresenceSelector', () => {
  it('leaves a plain attribute name to match by value', () => {
    expect(testIdPresenceSelector('data-testid', 'save')).toBeUndefined()
  })

  it('turns a prefix pattern into a presence selector', () => {
    expect(testIdPresenceSelector('data-test-*', 'productions-count')).toBe(
      '[data-test-productions-count]',
    )
  })

  it("escapes '.' and ':', which are legal in a name but not in a bare CSS one", () => {
    expect(testIdPresenceSelector('data-test-*', 'a.b:c_d')).toBe('[data-test-a\\.b\\:c_d]')
  })

  it.each(['x"]', 'x] , *', 'two words', '', 'x\\y', 'x[y'])('refuses the id %j', id => {
    expect(() => testIdPresenceSelector('data-test-*', id)).toThrow(
      /is not a valid data-test-\* test id/,
    )
  })

  it('refuses a RegExp id, which cannot match an attribute name', () => {
    expect(() => testIdPresenceSelector('data-test-*', /card/)).toThrow(/is a RegExp/)
    expect(testIdPresenceSelector('data-testid', /card/)).toBeUndefined()
  })

  it.each(['*', '-x*', 'data test-*', 'data-[test]-*'])('refuses the pattern %j', pattern => {
    expect(() => testIdPresenceSelector(pattern, 'x')).toThrow(/is not a valid pattern/)
  })
})

describe('checkFileTarget', () => {
  const at = [testId('form')]
  const field = testId('avatar')

  it('accepts a file input, and several files for a multiple one', () => {
    expect(() => checkFileTarget({ multiple: false }, 1, at, field)).not.toThrow()
    expect(() => checkFileTarget({ multiple: true }, 3, at, field)).not.toThrow()
  })

  it('names what the target is when it is not a file input', () => {
    expect(() => checkFileTarget('<input type="text">', 1, at, field)).toThrow(
      /form.*avatar.* is not a file input: it is <input type="text">/s,
    )
  })

  it('refuses several files for an input that takes one', () => {
    expect(() => checkFileTarget({ multiple: false }, 2, at, field)).toThrow(
      /takes one file, not 2/,
    )
  })
})
