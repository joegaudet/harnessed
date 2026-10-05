---
'@harnessed-ts/gherkin': minor
'@harnessed-ts/playwright': minor
---

New `@harnessed-ts/gherkin`: a scenario-scoped world, a typed page registry (`definePages`) and a `{page}` parameter type (`pageParameter`) that rejects an unknown page name at step matching, with adapters for playwright-bdd (`/playwright-bdd`, `withWorld`) and cucumber-js (`/cucumber`, `HarnessedWorld`). `@harnessed-ts/playwright/bdd` re-exports `withWorld` from it, deprecated for one release.
