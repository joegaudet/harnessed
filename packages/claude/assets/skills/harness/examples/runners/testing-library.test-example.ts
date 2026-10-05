// A jsdom test with Testing Library. Matchers: import '@harnessed-ts/dom/matchers'.
// Render an element (JSX in a .tsx file), never call the component: its hooks
// only work when React renders it.
import { dom } from '@harnessed-ts/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { expect, it } from 'vitest'
import { Checkout } from '../src/pages/Checkout'
import { CheckoutPage } from '../harness/checkout.page'

it('paying shows the confirmation', async () => {
  render(createElement(Checkout, { token: 'abc' }))
  const checkout = new CheckoutPage(dom({ user: userEvent.setup() }))
  await checkout.expectReady()
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
