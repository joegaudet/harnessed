// Gherkin steps (playwright-bdd shown; @harnessed-ts/gherkin has adapters for
// cucumber-js, Cypress and Yadda too). Pages live in the scenario's world.
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { withWorld } from '@harnessed-ts/gherkin/playwright-bdd'
import { pw } from '@harnessed-ts/playwright'
import { expect } from '@playwright/test'
import { createBdd, defineParameterType, test as base } from 'playwright-bdd'
import { CheckoutPage } from '../harness/checkout.page'

const pages = definePages({ checkout: CheckoutPage })
defineParameterType(pageParameter(pages))

export const test = withWorld<{ checkout: CheckoutPage }, typeof base>(base)
const { Given, Then } = createBdd(test)

Given('I am on the {page} page', async ({ page, world }, name: 'checkout') => {
  world.checkout = pages.open(name, pw(page))
  await world.checkout.goto({ token: 'abc' })
})

Then('the total reads {string}', async ({ world }, total: string) => {
  await expect(world.checkout!.total).toReadAs(total)
})
