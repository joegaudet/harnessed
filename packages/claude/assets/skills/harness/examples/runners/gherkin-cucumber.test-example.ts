// Gherkin steps under cucumber-js. Cucumber builds a world per scenario, so the
// pages a scenario opens live on it (this.bag), never in a module-level let.
import assert from 'node:assert/strict'
import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  defineParameterType,
  Given,
  setWorldConstructor,
  Then,
} from '@cucumber/cucumber'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { HarnessedWorld } from '@harnessed-ts/gherkin/cucumber'
import { pw } from '@harnessed-ts/playwright'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { CheckoutPage } from '../harness/checkout.page'

const pageMap = { checkout: CheckoutPage }
const pages = definePages(pageMap)
defineParameterType(pageParameter(pages))

class AppWorld extends HarnessedWorld<{ checkout: CheckoutPage }, typeof pageMap> {
  override pages = pages
  page: Page | undefined
}
setWorldConstructor(AppWorld)

let browser: Browser
BeforeAll(async () => {
  browser = await chromium.launch()
})
AfterAll(async () => {
  await browser.close()
})

// A fresh page per scenario: the env is scenario-scoped, like the world.
Before(async function (this: AppWorld) {
  this.page = await browser.newPage({ baseURL: 'http://localhost:3000' })
  this.env = pw(this.page)
})
After(async function (this: AppWorld) {
  await this.page?.close()
})

Given('I am on the {page} page', async function (this: AppWorld, name: 'checkout') {
  this.bag.checkout = this.open(name)
  await this.bag.checkout.goto({ token: 'abc' })
})

Then('the total reads {string}', async function (this: AppWorld, total: string) {
  assert.equal(await this.bag.checkout!.total.text(), total)
})
