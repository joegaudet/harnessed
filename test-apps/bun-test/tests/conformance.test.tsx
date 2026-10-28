import { pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { describe, it } from 'bun:test'
import { show } from './show'

const context = (): ConformanceCtx => ({ show })

describe('conformance: dom driver under bun test', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
  // A page arrives here by being rendered, not by goto(): the shape of a happy-dom test.
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }
})
