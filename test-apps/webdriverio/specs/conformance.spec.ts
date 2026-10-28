import { mockSpecs, mockUrlSpecs, pageSpecs, specs, urlSpecs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { wdio } from '@harnessed-ts/webdriverio'
import { existingMock, mock, resetMocks } from '@harnessed-ts/webdriverio/mock'
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

  // Mocking needs BiDi. Over Classic every mock spec asserts the documented
  // refusal instead, so the gap is pinned rather than skipped.
  async function refusedOverClassic(): Promise<boolean> {
    if (browser.isBidi) return false
    const refusal = await mock(wdio(browser))
      .ready()
      .then(
        () => undefined,
        (error: Error) => error.message,
      )
    if (refusal === undefined || !/needs WebDriver BiDi/.test(refusal)) {
      throw new Error(`expected the Classic refusal, got ${String(refusal)}`)
    }
    return true
  }

  for (const spec of mockSpecs) {
    it(spec.name, async () => {
      if (await refusedOverClassic()) return
      await spec.run({ ...context(), env: () => wdio(browser) })
    })
  }

  for (const spec of mockUrlSpecs) {
    it(`url: ${spec.name}`, async () => {
      if (await refusedOverClassic()) return
      await spec.run({ env: wdio(browser) })
    })
  }

  // The browser outlives a test: anything a spec left unverified fails it.
  afterEach(async () => {
    resetMocks()
    // Over Classic the refused mock is dropped, so the next spec asks again.
    if (!browser.isBidi) await existingMock(wdio(browser))?.dispose()
  })
})
