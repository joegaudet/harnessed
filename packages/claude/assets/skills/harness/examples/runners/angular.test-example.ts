// An Angular component test under Vitest (zoneless). Matchers: import
// '@harnessed-ts/dom/matchers' in the Vitest setup file. Every harness action
// settles at fixture.whenStable(), so read straight after acting.
import { angular } from '@harnessed-ts/angular'
import { render } from '@testing-library/angular/zoneless'
import { expect, it } from 'vitest'
import { CheckoutComponent } from '../src/app/checkout/checkout.component'
import { CheckoutPage } from '../harness/checkout.page'

it('paying shows the confirmation', async () => {
  const { fixture } = await render(CheckoutComponent, { inputs: { token: 'abc' } })
  const checkout = new CheckoutPage(angular({ fixture }))
  await checkout.expectReady()
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
