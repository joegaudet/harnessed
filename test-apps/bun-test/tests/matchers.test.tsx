import { CardsPage, LoginPage } from '@harnessed-ts/conformance'
import { describe, expect, it } from 'bun:test'
import { show } from './show'

/** `@harnessed-ts/dom/matchers/bun`, preloaded by bunfig.toml, registers these with bun:test. */
describe('matchers: @harnessed-ts/dom/matchers/bun', () => {
  it('toBeAbsent passes for something not rendered', async () => {
    const login = new LoginPage(await show('login'))
    await expect(login.form.errorQuery).toBeAbsent()
  })

  it('toBeAbsent fails, with a count in the message, when it is rendered', async () => {
    const login = new LoginPage(await show('login-error'))
    // bun:test's `.rejects` cannot take an expectation's own promise, so catch it.
    let failure: unknown
    try {
      await expect(login.form.errorQuery).toBeAbsent()
    } catch (error) {
      failure = error
    }
    expect(String(failure)).toMatch(/1 node\(s\) matched/)
  })

  it('toReadAs compares a string and a pattern', async () => {
    const login = new LoginPage(await show('login-error'))
    await expect(login.form.errorQuery).toReadAs('Bad credentials')
    await expect(login.form.errorQuery).toReadAs(/credentials/)
  })

  it('toBeSelected reads aria-pressed off a harness host', async () => {
    const cards = new CardsPage(await show('cards'))
    await expect(cards.grid.cardAt(1)).not.toBeSelected()
    await cards.grid.chooseByLabel('Medium')
    await expect(cards.grid.cardAt(1)).toBeSelected()
  })

  it('a page is assertable against its own host', async () => {
    const login = new LoginPage(await show('login'))
    await expect(login).not.toBeAbsent()
  })
})
