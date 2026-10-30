# Gherkin

```bash
npm i -D @harnessed-ts/gherkin
```

`@harnessed-ts/gherkin` gives Gherkin steps three things, with an adapter per
runner:

- **A world**: a scenario-scoped bag for the pages a scenario builds up. Steps
  are separate functions, so the obvious place for a harness is a module-level
  `let`, which leaks into the next scenario as soon as the runner reuses a
  worker. Each adapter gives the bag a scenario's lifetime.
- **A page registry**: `definePages({ checkout: CheckoutPage })` names the pages a
  feature can open, and `pages.open(name, env)` constructs one, typed.
- **A `{page}` parameter type**: `pageParameter(pages)` matches only registered
  names, so a feature that names an unknown page fails at step matching, where
  the typo is.

Step bodies stay hand-written: the feature's wording is the team's, not a mirror
of method names. The registry and parameter type are the same under every
runner:

```ts
import { definePages, pageParameter } from '@harnessed-ts/gherkin'

export const pages = definePages({ checkout: CheckoutPage })
defineParameterType(pageParameter(pages)) // the runner's own defineParameterType
```

Nightwatch's Cucumber runner has an adapter too, `@harnessed-ts/gherkin/nightwatch`:
see [Gherkin (Nightwatch's Cucumber runner)](../runners/nightwatch.md#gherkin-nightwatchs-cucumber-runner).

## playwright-bdd

`withWorld` adds a `world` fixture to playwright-bdd's `test`. A fixture is
per-scenario, so it cannot leak:

```ts
import { withWorld } from '@harnessed-ts/gherkin/playwright-bdd'
import { pw } from '@harnessed-ts/playwright'
import { expect } from '@playwright/test'
import { createBdd, test as base } from 'playwright-bdd'
import { pages } from './pages'

export const test = withWorld<{ checkout: CheckoutPage }, typeof base>(base)
const { When, Then } = createBdd(test)

When('I open the {page} page', async ({ page, world }, name: 'checkout') => {
  world.checkout = pages.open(name, pw(page))
  await world.checkout.goto()
})
Then('the total is {string}', async ({ world }, total: string) => {
  expect(await world.checkout!.total()).toBe(total)
})
```

`@harnessed-ts/playwright/bdd` still re-exports `withWorld`, deprecated for one
release.

## cucumber-js

cucumber-js builds a new world object per scenario, so `HarnessedWorld` keeps
the bag on it. Assign the registry in a subclass and set `env` in a `Before`;
`this.open(name)` builds a page with it:

```ts
import { Before, setWorldConstructor, Then, When } from '@cucumber/cucumber'
import { definePages } from '@harnessed-ts/gherkin'
import { HarnessedWorld } from '@harnessed-ts/gherkin/cucumber'
import { pw } from '@harnessed-ts/playwright'

const pageMap = { checkout: CheckoutPage }
class AppWorld extends HarnessedWorld<{ checkout: CheckoutPage }, typeof pageMap> {
  override pages = definePages(pageMap)
}
setWorldConstructor(AppWorld)

// `browser`: a Playwright browser launched in a BeforeAll.
Before(async function (this: AppWorld) {
  this.env = pw(await browser.newPage()) // or wdio(browser), puppeteer(page), …
})
When('I open the {page} page', async function (this: AppWorld, name: 'checkout') {
  this.bag.checkout = this.open(name)
  await this.bag.checkout.goto()
})
```

## Cypress cucumber

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

## ember-cli-yadda

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

To add `$page` to a dictionary that defines other terms, pass it in:
`steps({ pages, env, dictionary: pageDictionary(pages, { dictionary }) })`. Adding
the term to the same dictionary again returns it unchanged, so a module-level
dictionary is safe inside the per-scenario default export.

Make the feature an application test (`@setupapplicationtest`, or a default in
`tests/helpers/yadda-annotations`) so `goto()` drives the router. ember-cli-yadda
0.7 predates Ember 6: override its `ember-cli-htmlbars` to `^7`, and since Yadda 3
imports `node:fs`, strip the `node:` scheme for Yadda's modules in
ember-auto-import's webpack config — `test-apps/ember-classic/ember-cli-build.js`
shows both.

**Mocking:** `this.mocks` on the cucumber-js world, `mocks` in a Yadda step, `withMocks(test)` under playwright-bdd, `cy.mock` under Cypress — see [Mocking APIs](../mocking/mocking-apis.md).
