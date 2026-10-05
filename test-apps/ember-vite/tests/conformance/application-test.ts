import { module, test } from 'qunit'
import { setupApplicationTest } from 'ember-qunit'
import { visit } from '@ember/test-helpers'
import { pageSpecs, urlSpecs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { ember } from '@harnessed-ts/ember'

/**
 * Pages in application tests, where a view is reached through the router and
 * `goto()` drives it: the page specs again, and the URL specs that only a
 * driver able to navigate runs.
 */
const ctx: ConformanceCtx = {
  async show(view: View) {
    await visit(`/${viewSearch(view)}`)
    return ember()
  },
}

module('conformance: ember (application)', function (hooks) {
  setupApplicationTest(hooks)

  for (const spec of pageSpecs) {
    test(`page: ${spec.name}`, async function (assert) {
      assert.expect(0)
      await spec.run(ctx)
    })
  }

  for (const spec of urlSpecs) {
    test(`url: ${spec.name}`, async function (assert) {
      assert.expect(0)
      await spec.run({ env: ember() })
    })
  }
})
