import { createQuery, testId } from '@harnessed-ts/core'
import type { Assertable, Query } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import QUnit from 'qunit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { install } from '../src/index'

/**
 * `assert.harness(subject)` in the qunit-dom style. Each check reports through
 * `pushResult`, so QUnit counts it, names it in the output, and shows actual and
 * expected. They are async — a harness reads the page through a driver — so a
 * test awaits them.
 *
 * Driven against QUnit's real `assert` prototype with `pushResult` captured, so
 * these run in Vitest without starting a QUnit run.
 */
interface Pushed {
  result: boolean
  actual: unknown
  expected: unknown
  message: string
  negative?: boolean
}

let pushed: Pushed[]

function assertion(): Assert {
  pushed = []
  const assert = Object.create(QUnit.assert) as Assert
  assert.pushResult = (entry: Pushed) => {
    pushed.push(entry)
  }
  return assert
}

function target(id: string): Query {
  return createQuery(dom({ user: userEvent.setup() }), [], testId(id))
}

function show(html: string): void {
  document.body.innerHTML = html
}

beforeAll(() => {
  install(QUnit)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('@harnessed-ts/qunit', () => {
  it('isAbsent passes when nothing matches and fails naming the count', async () => {
    show('<p data-testid="banner">Hi</p>')
    const assert = assertion()
    await assert.harness(target('missing')).isAbsent()
    await assert.harness(target('banner')).isAbsent()
    expect(pushed.map(entry => entry.result)).toEqual([true, false])
    expect(pushed[1]!.message).toMatch(/1 node\(s\) matched/)
  })

  it('isPresent is the negation, with its own message', async () => {
    show('<p data-testid="banner">Hi</p>')
    const assert = assertion()
    await assert.harness(target('banner')).isPresent()
    await assert.harness(target('missing')).isPresent()
    expect(pushed.map(entry => entry.result)).toEqual([true, false])
    expect(pushed[1]!.message).toMatch(/expected the target to be present/)
    // Reported as "Expected: NOT 0", not as an equal pair.
    expect(pushed[1]).toMatchObject({ actual: 0, expected: 0, negative: true })
  })

  it('isSelected and isNotSelected read aria-pressed', async () => {
    show(
      '<button data-testid="on" aria-pressed="true">On</button><button data-testid="off">Off</button>',
    )
    const assert = assertion()
    await assert.harness(target('on')).isSelected()
    await assert.harness(target('off')).isNotSelected()
    await assert.harness(target('off')).isSelected()
    expect(pushed.map(entry => entry.result)).toEqual([true, true, false])
  })

  it('readsAs reports actual and expected for QUnit to diff', async () => {
    show('<span data-testid="price">$12</span>')
    const assert = assertion()
    await assert.harness(target('price')).readsAs(/^\$/)
    await assert.harness(target('price')).readsAs('$13')
    await assert.harness(target('price')).doesNotReadAs('$13')
    expect(pushed.map(entry => entry.result)).toEqual([true, false, true])
    expect(pushed[1]).toMatchObject({ actual: '$12', expected: '$13' })
  })

  it('a custom message replaces the default', async () => {
    show('')
    const assert = assertion()
    await assert.harness(target('missing')).isPresent('the banner shows after saving')
    expect(pushed[0]!.message).toBe('the banner shows after saving')
  })

  it('accepts a harness, asserting against its host', async () => {
    show('<p data-testid="banner">Hi</p>')
    const assert = assertion()
    // The structural shape of a harness: core reads only `self`.
    const harness = { self: target('banner') } as unknown as Assertable
    await assert.harness(harness).readsAs('Hi')
    expect(pushed[0]!.result).toBe(true)
  })
})
