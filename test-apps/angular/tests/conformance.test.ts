import { pageSpecs, specs, urlSpecs } from '@harnessed-ts/conformance'
import { describe, it } from 'vitest'
import { rendered, renderRouted, routed } from './show'

/**
 * The whole catalog under the angular driver, with the view rendered through
 * TestBed — the shape of most Angular component tests. Every spec, no opt-outs.
 */
describe('conformance: angular driver (rendered)', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(rendered)
    })
  }
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(rendered)
    })
  }
})

/**
 * With the router provided, a view is reached by navigating, and `goto()`
 * drives the router: the page specs again, and the URL specs that only a
 * driver able to navigate runs.
 */
describe('conformance: angular driver (routed)', () => {
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(routed)
    })
  }
  for (const spec of urlSpecs) {
    it(`url: ${spec.name}`, async () => {
      await spec.run({ env: await renderRouted() })
    })
  }
})
