import '@harnessed-ts/webdriverio/matchers'
import { CardsPage, LoginPage } from '@harnessed-ts/conformance'
import { $, expect } from '@wdio/globals'
import { show } from './stage'

// Matcher *registration* is runner-specific, which is why this is not in the catalog.
describe('matchers: expect-webdriverio', () => {
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

  it("leaves expect-webdriverio's own toBeSelected to WebdriverIO elements", async () => {
    await show('login')
    // An <option>: WebdriverIO's isSelected, not a harness's aria-pressed.
    await expect($('option[value="free"]')).toBeSelected()
    await expect($('option[value="pro"]')).not.toBeSelected()
  })

  it('a page is assertable against its own host', async () => {
    const login = new LoginPage(await show('login'))
    await expect(login).not.toBeAbsent()
  })
})
