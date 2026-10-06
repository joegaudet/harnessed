// A WebdriverIO spec. Matchers: import '@harnessed-ts/webdriverio/matchers'.
import { browser, expect } from '@wdio/globals'
import { wdio } from '@harnessed-ts/webdriverio'
import { CheckoutPage } from '../harness/checkout.page'

describe('checkout', () => {
  it('paying shows the confirmation', async () => {
    const checkout = new CheckoutPage(wdio(browser))
    await checkout.goto({ token: 'abc' })
    const confirmation = await checkout.pay()
    await expect(confirmation.heading).toReadAs('Thanks!')
  })
})
