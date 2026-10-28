import assert from 'node:assert/strict'
import {
  Before,
  defineParameterType,
  Given,
  setWorldConstructor,
  Then,
  When,
} from '@cucumber/cucumber'
import { WizardPage } from '@harnessed-ts/conformance'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { HarnessedWorld, nightwatchEnv } from '@harnessed-ts/gherkin/nightwatch'

const pages = definePages({ wizard: WizardPage })
defineParameterType(pageParameter(pages))

class AppWorld extends HarnessedWorld {
  pages = pages
}
setWorldConstructor(AppWorld)

// Nightwatch's own Before has launched this scenario's browser by now: the env
// is scenario-scoped, like the world.
Before(nightwatchEnv)

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
