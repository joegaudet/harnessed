import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { reviveStrictViolation, StrictModeViolation, strictViolation } from '../src/errors'
import type * as Core from '../src'
import { testId } from '../src/selector'

const wording = strictViolation(2, [], testId('card')).message

describe('StrictModeViolation', () => {
  it('is recognised by `instanceof` across copies of core, as Cypress loads it twice', () => {
    // The built CJS copy: a second module instance, as a separately bundled
    // support file and spec are. `pnpm build` must run first.
    const other = createRequire(import.meta.url)('../dist/index.cjs') as typeof Core
    expect(other.StrictModeViolation).not.toBe(StrictModeViolation)
    expect(other.strictViolation(2, [], testId('card'))).toBeInstanceOf(StrictModeViolation)
    expect(strictViolation(2, [], testId('card'))).toBeInstanceOf(other.StrictModeViolation)
  })

  it('is not claimed by an error that merely shares the name', () => {
    const named = Object.assign(new Error(wording), { name: 'StrictModeViolation' })
    expect(named).not.toBeInstanceOf(StrictModeViolation)
    expect(new Error(wording)).not.toBeInstanceOf(StrictModeViolation)
    expect(null).not.toBeInstanceOf(StrictModeViolation)
  })

  it('leaves a subclass to the prototype chain, so a plain violation is not one of it', () => {
    class Narrower extends StrictModeViolation {}
    expect(new Narrower(wording)).toBeInstanceOf(Narrower)
    expect(new Narrower(wording)).toBeInstanceOf(StrictModeViolation)
    expect(strictViolation(2, [], testId('card'))).not.toBeInstanceOf(Narrower)
  })
})

describe('reviveStrictViolation', () => {
  it("restores core's class from an error that kept only the name, as WebDriver hands it over", () => {
    const crossed = Object.assign(new Error(wording), { name: 'StrictModeViolation' })
    const revived = reviveStrictViolation(crossed)
    expect(revived).toBeInstanceOf(StrictModeViolation)
    expect((revived as Error).message).toBe(wording)
    expect((revived as Error).cause).toBe(crossed)
  })

  it('drops the name a transport folded into the message, as CDP does for a minified class', () => {
    const crossed = new Error(`StrictModeViolation: ${wording}`)
    const revived = reviveStrictViolation(crossed)
    expect(revived).toBeInstanceOf(StrictModeViolation)
    expect((revived as Error).message).toBe(wording)
  })

  it('restores a violation raised in another realm, which `instanceof Error` cannot see', () => {
    const foreign: unknown = runInNewContext(
      `Object.assign(new Error(message), { name: 'StrictModeViolation' })`,
      { message: wording },
    )
    expect(foreign).not.toBeInstanceOf(Error)
    const revived = reviveStrictViolation(foreign)
    expect(revived).toBeInstanceOf(StrictModeViolation)
    expect((revived as Error).message).toBe(wording)
  })

  it('leaves a violation that never crossed, and every other error, as it is', () => {
    const own = strictViolation(2, [], testId('card'))
    expect(reviveStrictViolation(own)).toBe(own)
    const other = new Error('Unable to find an element by: [data-testid="card"]')
    expect(reviveStrictViolation(other)).toBe(other)
    expect(reviveStrictViolation('a string')).toBe('a string')
  })
})
