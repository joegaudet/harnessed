---
'@harnessed-ts/gherkin': minor
'@harnessed-ts/playwright': minor
---

New `@harnessed-ts/gherkin`: a scenario-scoped world, a typed page registry (`definePages`) and a `{page}` parameter type (`pageParameter`) that rejects an unknown page name at step matching, with adapters for playwright-bdd (`/playwright-bdd`, `withWorld`), cucumber-js (`/cucumber`, `HarnessedWorld`), @badeball/cypress-cucumber-preprocessor (`/cypress`, `cypressWorld`) and ember-cli-yadda or plain Yadda (`/yadda`, `yaddaWorld`, with a `$page` term from `pageDictionary`). `@harnessed-ts/playwright/bdd` re-exports `withWorld` from it, deprecated for one release.
