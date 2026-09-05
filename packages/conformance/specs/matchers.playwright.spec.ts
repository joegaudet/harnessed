import '@harnessed-ts/playwright/matchers'
import { expect, test } from '@playwright/test'
import { CardGridHarness } from '../fixture/harnesses/CardGrid.harness'
import { LoginFormHarness } from '../fixture/harnesses/LoginForm.harness'
import { playwrightContext } from './context'

/** Matcher *registration* is runner-specific, which is why this is not in the catalog. */
test('toBeAbsent passes for something not rendered', async ({ page }) => {
  const form = new LoginFormHarness(await playwrightContext(page).show('login'))
  await expect(form.errorQuery).toBeAbsent()
})

test('toBeAbsent fails, with a count in the message, when it is rendered', async ({ page }) => {
  const form = new LoginFormHarness(await playwrightContext(page).show('login-error'))
  await expect(expect(form.errorQuery).toBeAbsent()).rejects.toThrow(/1 node\(s\) matched/)
})

test('toReadAs compares a string and a pattern', async ({ page }) => {
  const form = new LoginFormHarness(await playwrightContext(page).show('login-error'))
  await expect(form.errorQuery).toReadAs('Bad credentials')
  await expect(form.errorQuery).toReadAs(/credentials/)
})

test('toBeSelected reads aria-pressed off a harness host', async ({ page }) => {
  const grid = new CardGridHarness(await playwrightContext(page).show('cards'))
  await expect(grid.cardAt(1)).not.toBeSelected()
  await grid.chooseByLabel('Medium')
  await expect(grid.cardAt(1)).toBeSelected()
})
