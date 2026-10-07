# @harnessed-ts/gherkin

## 0.4.0

### Minor Changes

- 9666a3d: New `@harnessed-ts/gherkin`: a scenario-scoped world, a typed page registry (`definePages`) and a `{page}` parameter type (`pageParameter`) that rejects an unknown page name at step matching, with adapters for playwright-bdd (`/playwright-bdd`, `withWorld`), cucumber-js (`/cucumber`, `HarnessedWorld`), @badeball/cypress-cucumber-preprocessor (`/cypress`, `cypressWorld`) and ember-cli-yadda or plain Yadda (`/yadda`, `yaddaWorld`, with a `$page` term from `pageDictionary`). `@harnessed-ts/playwright/bdd` re-exports `withWorld` from it, deprecated for one release.

### Patch Changes

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
