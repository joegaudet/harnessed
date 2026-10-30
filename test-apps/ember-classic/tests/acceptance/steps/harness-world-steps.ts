import { DataPage, WizardPage } from '@harnessed-ts/conformance'
import { ember } from '@harnessed-ts/ember'
import { json } from '@harnessed-ts/ember/mock'
import { definePages } from '@harnessed-ts/gherkin'
import { yaddaWorld } from '@harnessed-ts/gherkin/yadda'

/**
 * The steps of the shared packages/gherkin/features/harness-world.feature.
 * ember-cli-yadda calls this once per scenario, inside the scenario's
 * application test, so each scenario gets a fresh world.
 */
const pages = definePages({ wizard: WizardPage, data: DataPage })

type Step = WizardPage['stepOne'] | WizardPage['stepTwo']
const harnessWorld = yaddaWorld<{ wizard: WizardPage; data: DataPage; step: Step }>()

export default function (assert: Assert) {
  const steps = harnessWorld.steps({ pages, env: () => ember() })

  steps
    // Given or Then: a step's keyword is not part of what it matches.
    .step('the world is empty', ({ world }) => {
      assert.deepEqual(world, {})
    })
    .when('I open the $page page', async ({ world, open }, name: 'wizard' | 'data') => {
      if (name === 'data') {
        world.data = open(name)
        await world.data.goto()
        return
      }
      const wizard = open(name)
      await wizard.goto()
      world.wizard = wizard
      world.step = wizard.stepOne
    })
    .given('the API answers the user as "$name"', async ({ mocks }, name: string) => {
      await mocks.get('/api/users/:id').reply(json({ name }))
    })
    .then('the user shows "$name"', async ({ world }, name: string) => {
      assert.strictEqual(await world.data?.screen.userName(), name)
    })
    .then('the wizard shows "$heading"', async ({ world }, heading: string) => {
      assert.strictEqual(await world.wizard?.stepOne.heading(), heading)
    })
    .when('I continue from step one', async ({ world }) => {
      world.step = await world.wizard?.stepOne.continue()
    })
    .then('the current step shows "$heading"', async ({ world }, heading: string) => {
      assert.strictEqual(await world.step?.heading(), heading)
    })

  return steps.library
}
