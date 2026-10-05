import { module, test } from 'qunit'
import { setupApplicationTest } from 'ember-qunit'
import { visit } from '@ember/test-helpers'
import { ember } from '@harnessed-ts/ember'
import { WizardHarness } from '../harness/wizard.harness'

/**
 * The shape of an app's own acceptance test: a harness from the app's test
 * tree, compiled by its Babel pipeline, asserted through assert.harness.
 */
module('Acceptance | wizard, through an app-compiled harness', function (hooks) {
  setupApplicationTest(hooks)

  test('continuing moves to step two', async function (assert) {
    await visit('/')
    const wizard = new WizardHarness(ember())

    await assert.harness(wizard.heading).readsAs('Step one')
    await wizard.continue()
    await assert.harness(wizard.heading).readsAs('Step two')
    await assert.harness(wizard.heading).doesNotReadAs('Step one')
  })
})
