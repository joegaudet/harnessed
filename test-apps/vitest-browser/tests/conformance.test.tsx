import { mockSpecs, pageSpecs, specs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import { resetMocks } from '@harnessed-ts/vitest-browser/mock'
import { afterEach, describe, it } from 'vitest'
import { show } from './show'

const context = (): ConformanceCtx => ({ show })

describe('conformance: vitest-browser driver', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }
  // Component testing: a page arrives by being rendered, not by goto(), so the
  // driver registers no navigation and `urlSpecs` do not apply.
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }
  // The page is the network: an env needs no rendered tree to mock it.
  for (const spec of mockSpecs) {
    it(spec.name, async () => {
      await spec.run({ ...context(), env: () => vitestBrowser() })
    })
  }
})

// The page outlives a test: anything a spec left unverified fails it.
afterEach(() => resetMocks())
