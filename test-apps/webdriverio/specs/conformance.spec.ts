import { pageSpecs, specs, urlSpecs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { wdio } from '@harnessed-ts/webdriverio'
import { browser } from '@wdio/globals'
import { show } from './stage'

function context(): ConformanceCtx {
  return { show }
}

describe('conformance: webdriverio driver', () => {
  for (const spec of specs) {
    it(spec.name, async () => {
      await spec.run(context())
    })
  }

  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async () => {
      await spec.run(context())
    })
  }

  // This driver can navigate, so it runs the URL behaviour too.
  for (const spec of urlSpecs) {
    it(`url: ${spec.name}`, async () => {
      await spec.run({ env: wdio(browser) })
    })
  }
})
