import '@harnessed-ts/vitest-browser/matchers'
import { CardsPage, LoginPage } from '@harnessed-ts/conformance'
import { describe, expect, it } from 'vitest'
import { show } from './show'

/** Matcher registration is per runner, so this cannot live in the shared catalog. */
describe('matchers: vitest-browser driver', () => {
  it('toBeAbsent passes for something not rendered', async () => {
    const login = new LoginPage(await show('login'))
    await expect(login.form.errorQuery).toBeAbsent()
  })

  it('toBeAbsent fails, with a count in the message, when it is rendered', async () => {
    const login = new LoginPage(await show('login-error'))
    await expect(expect(login.form.errorQuery).toBeAbsent()).rejects.toThrow(/1 node\(s\) matched/)
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
