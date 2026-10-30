# Matchers

```ts
import '@harnessed-ts/dom/matchers' // or '@harnessed-ts/playwright/matchers'

await expect(card).toBeSelected()
await expect(banner).toBeAbsent()
await expect(price).toReadAs(/^\$/)
```

They take a target or a harness. `toReadAs` rather than `toHaveText` because
Playwright already ships a `toHaveText` for Locators.

The same three checks, with the same failure messages, in the two other
assertion styles a runner is likely to use. All of them are async — await them.

```ts
// QUnit (ember-qunit): call install(QUnit) once, from tests/test-helper
import { install } from '@harnessed-ts/qunit'
install(QUnit)

await assert.harness(card).isSelected() // .isNotSelected()
await assert.harness(banner).isAbsent() // .isPresent()
await assert.harness(price).readsAs(/^\$/) // .doesNotReadAs()

// Chai (Mocha, Cypress, WebdriverIO under Mocha)
import { harnessedChai } from '@harnessed-ts/chai'
chai.use(harnessedChai)

await expect(card).to.be.selected
await expect(banner).to.be.absent // .not.to.be.absent
await expect(price).to.readAs(/^\$/)
```

A failure under QUnit or Chai also reports what was read beside what was wanted,
so their reporters show both.
