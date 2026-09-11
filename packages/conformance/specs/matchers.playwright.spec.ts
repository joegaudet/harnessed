import '@harnessed-ts/playwright/matchers'
import { expect, test } from '@playwright/test'
import { CardsPage } from '../fixture/harnesses/pages/cards.page'
import { LoginPage } from '../fixture/harnesses/pages/login.page'
import { playwrightContext } from './context'

/** Matcher *registration* is runner-specific, which is why this is not in the catalog. */
test('toBeAbsent passes for something not rendered', async ({ page }) => {
  const login = new LoginPage(await playwrightContext(page).show('login'))
  await expect(login.form.errorQuery).toBeAbsent()
})

test('toBeAbsent fails, with a count in the message, when it is rendered', async ({ page }) => {
  const login = new LoginPage(await playwrightContext(page).show('login-error'))
  await expect(expect(login.form.errorQuery).toBeAbsent()).rejects.toThrow(/1 node\(s\) matched/)
})

test('toReadAs compares a string and a pattern', async ({ page }) => {
  const login = new LoginPage(await playwrightContext(page).show('login-error'))
  await expect(login.form.errorQuery).toReadAs('Bad credentials')
  await expect(login.form.errorQuery).toReadAs(/credentials/)
})

test('toBeSelected reads aria-pressed off a harness host', async ({ page }) => {
  const cards = new CardsPage(await playwrightContext(page).show('cards'))
  await expect(cards.grid.cardAt(1)).not.toBeSelected()
  await cards.grid.chooseByLabel('Medium')
  await expect(cards.grid.cardAt(1)).toBeSelected()
})

test('a page is assertable against its own host', async ({ page }) => {
  const login = new LoginPage(await playwrightContext(page).show('login'))
  await expect(login).not.toBeAbsent()
})
