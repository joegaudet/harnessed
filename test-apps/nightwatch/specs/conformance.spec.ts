import { pageSpecs, specs, urlSpecs } from '@harnessed-ts/conformance'
import type { ConformanceCtx } from '@harnessed-ts/conformance'
import { nightwatch } from '@harnessed-ts/nightwatch'
import { show } from '../support/stage.ts'

function context(): ConformanceCtx {
  return { show }
}

// The same file under Nightwatch's own runner and its Mocha runner: both give
// `describe`, `it` and the `browser` global.
describe('conformance: nightwatch driver', function () {
  for (const spec of specs) {
    it(spec.name, async function () {
      await spec.run(context())
    })
  }

  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, async function () {
      await spec.run(context())
    })
  }

  // This driver can navigate, so it runs the URL behaviour too.
  for (const spec of urlSpecs) {
    it(`url: ${spec.name}`, async function () {
      await spec.run({ env: nightwatch(browser) })
    })
  }
})
