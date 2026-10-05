// A jsdom test with Testing Library. Matchers: import '@harnessed-ts/dom/matchers'.
import { dom } from '@harnessed-ts/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Checkout } from '../src/pages/Checkout'
import { CheckoutPage } from '../harness/checkout.page'

it('paying shows the confirmation', async () => {
  render(Checkout({ token: 'abc' }))
  const checkout = new CheckoutPage(dom({ user: userEvent.setup() }))
  await checkout.expectReady()
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
