// Gherkin steps under @badeball/cypress-cucumber-preprocessor. Every scenario in
// a feature shares one spec bundle, so pages live in cypressWorld()'s world,
// emptied before each scenario, never in a module-level let. Harness calls are
// promises, so a step runs them inside cy.harnessEnv, which
// import '@harnessed-ts/cypress/support' (cypress/support/e2e.ts) registers.
import { defineParameterType, Given, Then } from '@badeball/cypress-cucumber-preprocessor'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { cypressWorld } from '@harnessed-ts/gherkin/cypress'
import { CheckoutPage } from '../harness/checkout.page'

const pages = definePages({ checkout: CheckoutPage })
defineParameterType(pageParameter(pages))
const { world } = cypressWorld<{ checkout: CheckoutPage }>()

Given('I am on the {page} page', (name: 'checkout') => {
  cy.harnessEnv(async env => {
    const checkout = pages.open(name, env)
    await checkout.goto({ token: 'abc' })
    world().checkout = checkout
  })
})

Then('the total reads {string}', (total: string) => {
  cy.harnessEnv(() => world().checkout!.total.text()).should('eq', total)
})
