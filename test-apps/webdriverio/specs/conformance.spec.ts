import { pageSpecs, specs, urlSpecs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { wdio } from '@harnessed-ts/webdriverio'
import { browser } from '@wdio/globals'

function context(): ConformanceCtx {
  return {
    async show(view: View) {
      await browser.url(`/${viewSearch(view)}`)
      // The fixture's stage is the readiness signal both reference runners wait on.
      await browser.waitUntil(() =>
        browser.execute(() => document.querySelector('[data-testid="stage"]') !== null),
      )
      return wdio(browser)
    },
  }
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
