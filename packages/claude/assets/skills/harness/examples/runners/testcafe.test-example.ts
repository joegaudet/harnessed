// A TestCafe test: the env holds the test controller.
import { testcafe } from '@harnessed-ts/testcafe'
import { CheckoutPage } from '../harness/checkout.page'

fixture('checkout').page('http://localhost:3000')

test('paying shows the confirmation', async t => {
  const checkout = new CheckoutPage(testcafe(t))
  await checkout.goto({ token: 'abc' })
  const confirmation = await checkout.pay()
  await t.expect(await confirmation.heading.text()).eql('Thanks!')
})
