---
'@harnessed-ts/page': minor
'@harnessed-ts/conformance': minor
---

`PageHarness.urlFor(params)` returns the URL `goto()` would navigate to — params substituted at every occurrence and URL-encoded — without navigating, and under any driver. A runner that queues its own navigation (Cypress's `cy.visit`) needs the URL without the `goto()`. Covered by two new conformance specs: `urlFor` under a driver that cannot navigate, and `goto` landing on exactly the URL `urlFor` reports.
