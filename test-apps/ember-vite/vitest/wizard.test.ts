import { describe, expect } from 'vitest'
import { visit } from '@ember/test-helpers'
import { applicationTest } from 'ember-vitest'
import { ember } from '@harnessed-ts/ember'
import App from 'test-app-ember-vite/app'
import { WizardHarness } from '../tests/harness/wizard.harness'

/** A BDD-style acceptance test: an app-compiled harness, asserted through Chai. */
const it = applicationTest.extend('app', () => App)

describe('the wizard', () => {
  it('moves to step two on continue', async () => {
    await visit('/')
    const wizard = new WizardHarness(ember())

    await expect(wizard.heading).to.readAs('Step one')
    await wizard.continue()
    await expect(wizard.heading).to.readAs('Step two')
    await expect(wizard.heading).not.to.readAs('Step one')
  })
})
