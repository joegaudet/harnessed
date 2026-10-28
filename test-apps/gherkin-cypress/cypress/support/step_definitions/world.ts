import { defineParameterType, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor'
import type { StepOnePage, StepTwoPage } from '@harnessed-ts/conformance'
import { DataPage, WizardPage } from '@harnessed-ts/conformance'
import { definePages, pageParameter } from '@harnessed-ts/gherkin'
import { cypressWorld } from '@harnessed-ts/gherkin/cypress'
import { json } from '@harnessed-ts/cypress/mock'

const pages = definePages({ wizard: WizardPage, data: DataPage })
defineParameterType(pageParameter(pages))
type PageName = (typeof pages.names)[number]

interface World {
  wizard: WizardPage
  data: DataPage
  step: StepOnePage | StepTwoPage
}

// Reset before every scenario. Steps run as Cypress commands, in order, so each
// one sees what the steps before it left in the world.
const { world } = cypressWorld<World>()

// Given or Then: a step's keyword is not part of what it matches.
Given('the world is empty', () => {
  expect(world()).to.deep.equal({})
})

// Harness calls are promises, so they run inside the bridge: one command each.
When('I open the {page} page', (name: PageName) => {
  cy.harnessEnv(async env => {
    if (name === 'data') {
      const data = pages.open(name, env)
      await data.goto()
      world().data = data
      return
    }
    const wizard = pages.open(name, env)
    await wizard.goto()
    world().wizard = wizard
    world().step = wizard.stepOne
  })
})

Given('the API answers the user as {string}', (name: string) => {
  cy.mock(api => api.get('/api/users/:id').reply(json({ name })))
})

Then('the user shows {string}', (name: string) => {
  cy.harnessEnv(() => world().data!.screen.userName()).should('eq', name)
})

Then('the wizard shows {string}', (heading: string) => {
  cy.harnessEnv(() => world().wizard!.stepOne.heading()).should('eq', heading)
})

When('I continue from step one', () => {
  cy.harnessEnv(async () => {
    world().step = await world().wizard!.stepOne.continue()
  })
})

Then('the current step shows {string}', (heading: string) => {
  cy.harnessEnv(() => world().step!.heading()).should('eq', heading)
})
