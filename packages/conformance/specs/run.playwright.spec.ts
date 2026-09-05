import { pw } from '@harnessed/playwright'
import { test } from '@playwright/test'
import { specs } from './catalog'
import { playwrightContext } from './context'
import { routeSpecs } from './routes.catalog'

for (const spec of specs) {
  test(spec.name, async ({ page }) => {
    await spec.run(playwrightContext(page))
  })
}

// Route behaviour has no dom-driver counterpart: a RouteHarness needs a real Page.
for (const spec of routeSpecs) {
  test(`route: ${spec.name}`, async ({ page }) => {
    await spec.run({ env: pw(page) })
  })
}
