import '@harnessed/playwright/matchers'
import { pw } from '@harnessed/playwright'
import { expect, test } from '@playwright/test'
import { CardGridHarness } from '../fixture/harnesses/CardGrid.harness'
import { LoginFormHarness } from '../fixture/harnesses/LoginForm.harness'

/** Matcher registration is per runner, so this cannot live in the shared catalog. */
test('toBeAbsent passes for something not rendered', async ({ page }) => {
  await page.goto('/?view=login')
  const form = new LoginFormHarness(pw(page))
  await expect(form.errorQuery).toBeAbsent()
})

test('toBeAbsent fails, with a count in the message, when it is rendered', async ({ page }) => {
  await page.goto('/?view=login&error=Bad%20credentials')
  const form = new LoginFormHarness(pw(page))
  await expect(expect(form.errorQuery).toBeAbsent()).rejects.toThrow(/1 node\(s\) matched/)
})

test('toReadAs compares a string and a pattern', async ({ page }) => {
  await page.goto('/?view=login&error=Bad%20credentials')
  const form = new LoginFormHarness(pw(page))
  await expect(form.errorQuery).toReadAs('Bad credentials')
  await expect(form.errorQuery).toReadAs(/credentials/)
})

test('toBeSelected reads aria-pressed off a harness host', async ({ page }) => {
  await page.goto('/?view=cards')
  const grid = new CardGridHarness(pw(page))
  await expect(grid.cardAt(1)).not.toBeSelected()
  await grid.chooseByLabel('Medium')
  await expect(grid.cardAt(1)).toBeSelected()
})
