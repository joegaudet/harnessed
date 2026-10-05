import nodeAssert from 'node:assert/strict'
import { describe, it } from 'vitest'
import assert from './assert'

/**
 * The specs run inside browsers (Testem, Cypress, Vitest browser mode) where
 * `node:assert` does not exist, so they use this instead. Each case checks it
 * agrees with `node:assert/strict` on the forms the catalog actually uses.
 */
describe('conformance assert', () => {
  it('equal compares with Object.is and names both sides', () => {
    assert.equal(1, 1)
    assert.equal(Number.NaN, Number.NaN)
    nodeAssert.throws(() => assert.equal<unknown>(1, '1'), /expected 1 to equal "1"/)
    nodeAssert.throws(() => assert.equal(0, -0))
    nodeAssert.throws(() => assert.equal(1, 2, 'custom'), /^AssertionError: custom$/)
  })

  it('ok rejects falsy values', () => {
    assert.ok(true)
    nodeAssert.throws(() => assert.ok(0, 'zero is not ok'), /zero is not ok/)
  })

  it('deepEqual compares arrays and plain objects structurally', () => {
    assert.deepEqual(['a', 'b'], ['a', 'b'])
    assert.deepEqual({ a: 1, b: [true] }, { a: 1, b: [true] })
    nodeAssert.throws(() => assert.deepEqual(['a'], ['a', 'b']), /deep-equal/)
    nodeAssert.throws(() => assert.deepEqual({ a: 1 }, { a: 1, b: undefined }))
    nodeAssert.throws(() => assert.deepEqual({ a: '1' }, { a: 1 }))
  })

  it('match tests a string against a pattern', () => {
    assert.match('/step-two?token=abc', /token=abc$/)
    nodeAssert.throws(() => assert.match('nope', /yes/), /to match \/yes\//)
  })

  it('throws checks a regexp against String(error)', () => {
    assert.throws(() => {
      throw new Error('cannot navigate')
    }, /^Error: cannot navigate$/)
    nodeAssert.throws(() => assert.throws(() => undefined, /x/), /did not throw/)
    nodeAssert.throws(() =>
      assert.throws(() => {
        throw new Error('other')
      }, /cannot navigate/),
    )
  })

  it('rejects accepts a regexp, a validator, or a bare message', async () => {
    await assert.rejects(() => Promise.reject(new Error('strict mode violation')), /strict mode/)
    await assert.rejects(
      () => Promise.reject(new Error('boom', { cause: new Error('inner') })),
      (error: unknown) => error instanceof Error && error.cause instanceof Error,
    )
    await assert.rejects(() => Promise.reject(new Error('any')), 'any rejection passes')
    await nodeAssert.rejects(
      () => assert.rejects(() => Promise.resolve(), 'must reject'),
      /must reject/,
    )
    await nodeAssert.rejects(
      () => assert.rejects(() => Promise.reject(new Error('a')), /b/),
      /Error: a/,
    )
    await nodeAssert.rejects(
      () =>
        assert.rejects(
          () => Promise.reject(new Error('a')),
          () => false,
        ),
      /validator/,
    )
  })
})
