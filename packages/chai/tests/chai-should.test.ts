import { createQuery, testId } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import * as chai from 'chai'
import { describe, it } from 'vitest'
import { harnessedChai } from '../src/index'

chai.use(harnessedChai)
chai.should()

/**
 * Core puts a `should` getter on every query for `@harnessed-ts/should`. Without
 * that package registered, it must step aside for Chai's own should interface.
 */
describe("Chai's should interface", () => {
  it('still reaches a query when @harnessed-ts/should is not registered', async () => {
    document.body.innerHTML = ''
    const banner = createQuery(dom({ user: userEvent.setup() }), [], testId('banner'))
    await banner.should.be.absent
  })
})
