import { pageSpecs, specs, urlSpecs } from '@harnessed-ts/conformance'
import { describe, it } from 'vitest'
import { useBrowser } from './session'

const session = useBrowser()

describe('conformance: puppeteer driver', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(session.ctx())
    })
  }

  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(session.ctx())
    })
  }

  // This driver can navigate, so the URL behaviour runs too.
  for (const spec of urlSpecs) {
    it(`url: ${spec.name}`, async () => {
      await spec.run({ env: session.env() })
    })
  }
})
