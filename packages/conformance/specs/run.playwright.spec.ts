import { pw } from '@harnessed/playwright'
import { test } from '@playwright/test'
import type { ConformanceCtx, View } from './catalog'
import { specs } from './catalog'
import { routeSpecs } from './routes.catalog'
import { viewSearch } from './views'

for (const spec of specs) {
  const runs = spec.drivers === undefined || spec.drivers.includes('playwright')
  if (!runs) {
    test.skip(`${spec.name} [not applicable to the playwright driver]`, () => {})
    continue
  }
  test(spec.name, async ({ page }) => {
    const ctx: ConformanceCtx = {
      driver: 'playwright',
      async show(view: View) {
        await page.goto(`/${viewSearch(view)}`)
        await page.waitForSelector('[data-testid="stage"]')
        return pw(page)
      },
    }
    await spec.run(ctx)
  })
}

// Route behaviour has no dom-driver counterpart: a RouteHarness needs a real Page.
for (const spec of routeSpecs) {
  test(`route: ${spec.name}`, async ({ page }) => {
    await spec.run({ page })
  })
}
