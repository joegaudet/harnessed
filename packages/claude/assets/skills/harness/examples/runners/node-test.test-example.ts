// node:test on jsdom: node --test --import global-jsdom/register --import @harnessed-ts/core/register
// node:test has no expect, so assertions come through @harnessed-ts/chai. Render
// an element (JSX in a .tsx file), never call the component: its hooks only work
// when React renders it.
import { harnessedChai } from '@harnessed-ts/chai'
import { dom } from '@harnessed-ts/dom'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as chai from 'chai'
import { afterEach, it } from 'node:test'
import { createElement } from 'react'
import { Checkout } from '../src/pages/Checkout'
import { CheckoutPage } from '../harness/checkout.page'

chai.use(harnessedChai)
// node:test has no globals, so Testing Library cannot register its cleanup itself.
afterEach(cleanup)

it('paying shows the confirmation', async () => {
  render(createElement(Checkout, { token: 'abc' }))
  const checkout = new CheckoutPage(dom({ user: userEvent.setup() }))
  await checkout.expectReady()
  const confirmation = await checkout.pay()
  await chai.expect(confirmation.heading).to.readAs('Thanks!')
})
