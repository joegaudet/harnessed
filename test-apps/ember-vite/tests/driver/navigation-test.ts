import { module, test } from 'qunit'
import { setupApplicationTest, setupRenderingTest } from 'ember-qunit'
import { WizardPage } from '@harnessed-ts/conformance'
import { ember } from '@harnessed-ts/ember'

/**
 * The router's URL is the truth in an Ember test, and there is not always one:
 * a rendering test has no router, and an application test has none until its
 * first visit. Both must refuse at once, not read as `/`.
 */
module('Ember driver | navigation without a router', function (hooks) {
  setupRenderingTest(hooks)

  test('assertPathname refuses at once in a rendering test', async function (assert) {
    const page = new WizardPage(ember())
    const started = Date.now()
    await assert.rejects(page.assertPathname('/', { timeout: 2000 }))
    assert.true(Date.now() - started < 500, `refused after ${Date.now() - started}ms`)
  })
})

module('Ember driver | navigation before the first visit', function (hooks) {
  setupApplicationTest(hooks)

  test('currentUrl refuses rather than reading as /', function (assert) {
    const page = new WizardPage(ember())
    assert.throws(() => page.currentUrl, /has not visited/)
  })
})
