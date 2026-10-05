// A Playwright test. Matchers: import '@harnessed-ts/playwright/matchers'.
import { pw } from '@harnessed-ts/playwright'
import { expect, test } from '@playwright/test'
import { CheckoutPage } from '../harness/checkout.page'

test('paying shows the confirmation', async ({ page }) => {
  const checkout = new CheckoutPage(pw(page))
  await checkout.goto({ token: 'abc' })
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
