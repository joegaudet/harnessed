### Cypress cucumber

```bash
npm i -D @harnessed-ts/gherkin @harnessed-ts/cypress @badeball/cypress-cucumber-preprocessor
```

Set up the preprocessor as its docs describe, and import
`@harnessed-ts/cypress/support` in the support file. `cypressWorld()` resets the
world before each scenario; steps read it through `world()`, and run harnesses
inside the bridge, since steps are Cypress commands:

```ts
import { defineParameterType, Then, When } from '@badeball/cypress-cucumber-preprocessor'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { cypressWorld } from '@harnessed-ts/gherkin/cypress'

const pages = definePages({ checkout: CheckoutPage })
defineParameterType(pageParameter(pages))
const { world } = cypressWorld<{ checkout: CheckoutPage }>()

When('I open the {page} page', (name: 'checkout') => {
  cy.harnessEnv(async env => {
    const page = pages.open(name, env)
    await page.goto()
    world().checkout = page
  })
})
Then('the total is {string}', (total: string) => {
  cy.harnessEnv(() => world().checkout!.total()).should('eq', total)
})
```

Call `cypressWorld()` once, at the top level of a step definitions file, and
share `world`; never keep pages in a module-level `let`.
