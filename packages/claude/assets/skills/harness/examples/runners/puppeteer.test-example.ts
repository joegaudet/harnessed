// Puppeteer under Vitest. Matchers: import '@harnessed-ts/puppeteer/matchers'.
import { puppeteer } from '@harnessed-ts/puppeteer'
import { expect, it } from 'vitest'
import { CheckoutPage } from '../harness/checkout.page'

it('paying shows the confirmation', async () => {
  const checkout = new CheckoutPage(puppeteer(page, { baseURL: 'http://localhost:3000' }))
  await checkout.goto({ token: 'abc' })
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
