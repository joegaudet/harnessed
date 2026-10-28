// A Nightwatch spec (its own runner or Mocha). Assert through Chai's own
// expect: chai.use(harnessedChai) from '@harnessed-ts/chai'. goto() resolves
// against launch_url.
import { harnessedChai } from '@harnessed-ts/chai'
import { nightwatch } from '@harnessed-ts/nightwatch'
import * as chai from 'chai'
import { CheckoutPage } from '../harness/checkout.page'

chai.use(harnessedChai)

describe('checkout', function () {
  it('paying shows the confirmation', async function () {
    const checkout = new CheckoutPage(nightwatch(browser))
    await checkout.goto({ token: 'abc' })
    const confirmation = await checkout.pay()
    await chai.expect(confirmation.heading).to.readAs('Thanks!')
  })
})
