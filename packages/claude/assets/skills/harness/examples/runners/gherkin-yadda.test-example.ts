// Gherkin steps under ember-cli-yadda. It calls this module's default export
// inside each scenario's test, so yaddaWorld().steps() gives every scenario a
// fresh world. `$page` matches only the names definePages registered.
// assert.harness comes from install(QUnit) in tests/test-helper (@harnessed-ts/qunit).
import { ember } from '@harnessed-ts/ember'
import { definePages } from '@harnessed-ts/gherkin'
import { yaddaWorld } from '@harnessed-ts/gherkin/yadda'
import { CheckoutPage } from '../harness/checkout.page'

const pages = definePages({ checkout: CheckoutPage })
const checkoutWorld = yaddaWorld<{ checkout: CheckoutPage }>()

export default function (assert: Assert) {
  const steps = checkoutWorld.steps({ pages, env: () => ember() })

  steps
    .given('I am on the $page page', async ({ world, open }, name: 'checkout') => {
      world.checkout = open(name)
      await world.checkout.goto({ token: 'abc' })
    })
    .then('the total reads "$total"', async ({ world }, total: string) => {
      await assert.harness(world.checkout!.total).readsAs(total)
    })

  return steps.library
}
