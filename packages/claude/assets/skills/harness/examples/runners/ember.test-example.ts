// An Ember application test: the page drives the router; assert.harness
// comes from install(QUnit) in tests/test-helper (@harnessed-ts/qunit).
import { module, test } from 'qunit'
import { setupApplicationTest } from 'ember-qunit'
import { ember } from '@harnessed-ts/ember'
import { CheckoutPage } from '../harness/checkout.page'

module('Acceptance | checkout', function (hooks) {
  setupApplicationTest(hooks)

  test('paying shows the confirmation', async function (assert) {
    const checkout = new CheckoutPage(ember())
    await checkout.goto({ token: 'abc' })
    const confirmation = await checkout.pay()
    await assert.harness(confirmation.heading).readsAs('Thanks!')
  })
})
