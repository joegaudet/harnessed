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
  When,
} from '@cucumber/cucumber'
import { WizardPage } from '@harnessed-ts/conformance'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { HarnessedWorld } from '@harnessed-ts/gherkin/cucumber'
import { pw } from '@harnessed-ts/playwright'
import { chromium } from 'playwright'

const pages = definePages({ wizard: WizardPage })
defineParameterType(pageParameter(pages))

class AppWorld extends HarnessedWorld {
  pages = pages
}
setWorldConstructor(AppWorld)

let browser
BeforeAll(async () => {
  browser = await chromium.launch()
})
AfterAll(async () => {
  await browser.close()
})

// A fresh page per scenario: the env is scenario-scoped, like the world.
Before(async function () {
  const page = await browser.newPage({ baseURL: 'http://localhost:5188' })
  this.page = page
  this.env = pw(page)
})
After(async function () {
  await this.page.close()
})

// Given or Then: a step's keyword is not part of what it matches.
Given('the world is empty', function () {
  assert.deepEqual(this.bag, {})
})

When('I open the {page} page', async function (name) {
  const wizard = this.open(name)
  await wizard.goto()
  this.bag.wizard = wizard
  this.bag.step = wizard.stepOne
})

Then('the wizard shows {string}', async function (heading) {
  assert.equal(await this.bag.wizard.stepOne.heading(), heading)
})

When('I continue from step one', async function () {
  this.bag.step = await this.bag.wizard.stepOne.continue()
})

Then('the current step shows {string}', async function (heading) {
  assert.equal(await this.bag.step.heading(), heading)
})
