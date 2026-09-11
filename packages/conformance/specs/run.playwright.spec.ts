import { pw } from '@harnessed-ts/playwright'
import { test } from '@playwright/test'
import { specs } from './catalog'
import { playwrightContext } from './context'
import { pageSpecs, urlSpecs } from './pages.catalog'

for (const spec of specs) {
  test(spec.name, async ({ page }) => {
    await spec.run(playwrightContext(page))
  })
}

for (const spec of pageSpecs) {
  test(`page: ${spec.name}`, async ({ page }) => {
    await spec.run(playwrightContext(page))
  })
}

// URL behaviour has no dom-driver counterpart: goto() needs a driver that can navigate.
for (const spec of urlSpecs) {
  test(`url: ${spec.name}`, async ({ page }) => {
    await spec.run({ env: pw(page) })
  })
}
