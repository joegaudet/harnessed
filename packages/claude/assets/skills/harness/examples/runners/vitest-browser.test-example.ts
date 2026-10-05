// A component test in Vitest browser mode: render, then enter through a page.
// Matchers: import '@harnessed-ts/vitest-browser/matchers'.
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import { render } from 'vitest-browser-react'
import { expect, it } from 'vitest'
import { Checkout } from '../src/pages/Checkout'
import { CheckoutPage } from '../harness/checkout.page'

it('paying shows the confirmation', async () => {
  await render(Checkout({ token: 'abc' }))
  const checkout = new CheckoutPage(vitestBrowser())
  await checkout.expectReady()
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
