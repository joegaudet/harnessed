// Gherkin steps under Nightwatch's Cucumber runner. Nightwatch opens a browser
// per scenario; Before(nightwatchEnv) turns it into the world's env, and the
// pages a scenario opens live on the world (this.bag), never in a module-level let.
import assert from 'node:assert/strict'
import { Before, defineParameterType, Given, setWorldConstructor, Then } from '@cucumber/cucumber'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { HarnessedWorld, nightwatchEnv } from '@harnessed-ts/gherkin/nightwatch'
import { CheckoutPage } from '../harness/checkout.page'

const pageMap = { checkout: CheckoutPage }
const pages = definePages(pageMap)
defineParameterType(pageParameter(pages))

class AppWorld extends HarnessedWorld<{ checkout: CheckoutPage }, typeof pageMap> {
  override pages = pages
}
setWorldConstructor(AppWorld)
Before(nightwatchEnv)

Given('I am on the {page} page', async function (this: AppWorld, name: 'checkout') {
  this.bag.checkout = this.open(name)
  await this.bag.checkout.goto({ token: 'abc' })
})

Then('the total reads {string}', async function (this: AppWorld, total: string) {
  assert.equal(await this.bag.checkout!.total.text(), total)
})
