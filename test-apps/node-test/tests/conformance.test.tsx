import { pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { describe, it } from 'node:test'
import { show } from './show.tsx'

const context = (): ConformanceCtx => ({ show })

describe('conformance: dom driver under node:test', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
  // A page arrives here by being rendered, not by goto(): the shape of a jsdom test.
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }
})
