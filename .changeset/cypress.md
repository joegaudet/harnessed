---
'@harnessed-ts/cypress': minor
---

A new Cypress driver for e2e and component tests: `cy.harness(Cls, async h => …)` runs a harness inside one command against the application under test, `cy.visitPage(Page, params)` visits a page's `urlFor()` and waits for it to be ready, and `goto()` works inside the bridge in e2e tests. Interactions use user-event by default, or trusted Chrome DevTools Protocol input with `realEvents: true` on Chromium.
