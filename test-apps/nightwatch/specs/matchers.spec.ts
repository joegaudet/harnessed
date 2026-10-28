import { harnessedChai } from '@harnessed-ts/chai'
import { CardsPage, LoginPage } from '@harnessed-ts/conformance'
import * as chai from 'chai'
import { show } from '../support/stage.ts'

// Chai's own `expect`, not the `expect` global Nightwatch installs for its
// element assertions.
chai.use(harnessedChai)
const { expect } = chai

/** The rejection a promise ends in, or a failure if it fulfils. */
async function rejection(promise: PromiseLike<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }
  throw new Error('expected the assertion to fail, and it passed')
}

// Matcher *registration* is runner-specific, which is why this is not in the catalog.
describe('matchers: @harnessed-ts/chai', function () {
  it('absent passes for something not rendered', async function () {
    const login = new LoginPage(await show('login'))
    await expect(login.form.errorQuery).to.be.absent
  })

  it('absent fails, with a count in the message, when it is rendered', async function () {
    const login = new LoginPage(await show('login-error'))
    const error = await rejection(expect(login.form.errorQuery).to.be.absent)
    expect(error.message).to.match(/1 node\(s\) matched/)
  })

  it('readAs compares a string and a pattern', async function () {
    const login = new LoginPage(await show('login-error'))
    await expect(login.form.errorQuery).to.readAs('Bad credentials')
    await expect(login.form.errorQuery).to.readAs(/credentials/)
  })

  it('selected reads aria-pressed off a harness host', async function () {
    const cards = new CardsPage(await show('cards'))
    await expect(cards.grid.cardAt(1)).not.to.be.selected
    await cards.grid.chooseByLabel('Medium')
    await expect(cards.grid.cardAt(1)).to.be.selected
  })

  it('a page is assertable against its own host', async function () {
    const login = new LoginPage(await show('login'))
    await expect(login).not.to.be.absent
  })
})
