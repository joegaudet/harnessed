### ember-cli-yadda

```bash
npm i -D @harnessed-ts/gherkin @harnessed-ts/ember ember-cli-yadda yadda
```

ember-cli-yadda compiles `tests/acceptance/<name>.feature` into a test that calls
the default export of `tests/acceptance/steps/<name>-steps` once per scenario, so
`yaddaWorld().steps()` there gives each scenario a fresh world. Steps take the
scenario first, and `$page` matches only a registered page:

```ts
import { ember } from '@harnessed-ts/ember'
import { definePages } from '@harnessed-ts/gherkin'
import { yaddaWorld } from '@harnessed-ts/gherkin/yadda'

const pages = definePages({ checkout: CheckoutPage })
const checkout = yaddaWorld<{ checkout: CheckoutPage }>()

export default function (assert: Assert) {
  const steps = checkout.steps({ pages, env: () => ember() })
  steps
    .when('I open the $page page', async ({ world, open }, name: 'checkout') => {
      world.checkout = open(name)
      await world.checkout.goto()
    })
    .then('the total is "$total"', async ({ world }, total: string) => {
      assert.strictEqual(await world.checkout?.total(), total)
    })
  return steps.library
}
```

Make the feature an application test (`@setupapplicationtest`, or a default in
`tests/helpers/yadda-annotations`) so `goto()` drives the router. ember-cli-yadda
0.7 predates Ember 6: override its `ember-cli-htmlbars` to `^7`, and since Yadda 3
imports `node:fs`, strip the `node:` scheme in ember-auto-import's webpack config
— `test-apps/ember-classic/ember-cli-build.js` shows both.
