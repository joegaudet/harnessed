import { pageSpecs, specs, urlSpecs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import type { EnvConfig } from '@harnessed-ts/core'
import { testcafe } from '@harnessed-ts/testcafe'
import { Selector } from 'testcafe'

/**
 * The React fixture `pnpm serve:fixture` serves. Absolute, and on 127.0.0.1:
 * a bare `'/'` fixture page is read as a file path rather than against
 * `baseUrl`, and Vite's `localhost` can bind IPv6 only while TestCafe's request
 * pipeline connects over IPv4.
 */
const FIXTURE = 'http://127.0.0.1:5184'

fixture('harnessed conformance').page(`${FIXTURE}/`)

/** The stage is the fixture's root: once it exists, the view has rendered. */
const stage = Selector('[data-testid="stage"]')

function context(t: TestController): ConformanceCtx {
  return {
    async show(view: View): Promise<EnvConfig> {
      await t.navigateTo(`${FIXTURE}/${viewSearch(view)}`)
      await t.expect(stage.exists).ok()
      return testcafe(t)
    },
  }
}

// Every spec in the catalog, one TestCafe test each, with no opt-outs.
for (const spec of specs) {
  test(spec.name, async t => {
    await spec.run(context(t))
  })
}

for (const spec of pageSpecs) {
  test(`page: ${spec.name}`, async t => {
    await spec.run(context(t))
  })
}

// URL behaviour needs a driver that can navigate, which this one can.
for (const spec of urlSpecs) {
  test(`url: ${spec.name}`, async t => {
    await spec.run({ env: testcafe(t) })
  })
}
