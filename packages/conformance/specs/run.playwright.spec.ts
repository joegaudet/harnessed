import { resetMocks } from '@harnessed-ts/mock'
import { pw } from '@harnessed-ts/playwright'
import { test } from '@playwright/test'
import { specs } from './catalog'
import { playwrightContext } from './context'
import { mockSpecs, mockUrlSpecs } from './mocks.catalog'
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

for (const spec of mockSpecs) {
  test(spec.name, async ({ page }) => {
    await spec.run({ ...playwrightContext(page), env: () => pw(page) })
  })
}

for (const spec of mockUrlSpecs) {
  test(`url: ${spec.name}`, async ({ page }) => {
    await spec.run({ env: pw(page) })
  })
}

// Anything a spec left unverified — an unanswered request, a failed handler —
// fails that spec.
test.afterEach(() => resetMocks())
