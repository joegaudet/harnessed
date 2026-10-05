import { StepOnePage, StepTwoPage, WizardPage } from '@harnessed-ts/conformance'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { withWorld } from '@harnessed-ts/gherkin/playwright-bdd'
import { pw } from '@harnessed-ts/playwright'
import { expect } from '@playwright/test'
import { createBdd, defineParameterType, test as base } from 'playwright-bdd'

const pages = definePages({ wizard: WizardPage })
defineParameterType(pageParameter(pages))

interface World {
  wizard: WizardPage
  step: StepOnePage | StepTwoPage
}

export const test = withWorld<World, typeof base>(base)
const { Given, When, Then } = createBdd(test)

// Given or Then: a step's keyword is not part of what it matches.
Given('the world is empty', ({ world }) => {
  expect(world).toEqual({})
})

When('I open the {page} page', async ({ page, world }, name: 'wizard') => {
  const wizard = pages.open(name, pw(page))
  await wizard.goto()
  world.wizard = wizard
  world.step = wizard.stepOne
})

Then('the wizard shows {string}', async ({ world }, heading: string) => {
  expect(await world.wizard!.stepOne.heading()).toBe(heading)
})

When('I continue from step one', async ({ world }) => {
  world.step = await world.wizard!.stepOne.continue()
})

Then('the current step shows {string}', async ({ world }, heading: string) => {
  expect(await world.step!.heading()).toBe(heading)
})
