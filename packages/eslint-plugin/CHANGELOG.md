# @harnessed-ts/eslint-plugin

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

### Patch Changes

- Updated dependencies
  - @harnessed-ts/config@0.2.0

## 0.1.0

First release.

Five rules that make the harness authoring conventions a gate rather than a
convention: no `page`/`screen` inside a harness, a required `@Harness({ host })`, a
non-empty `waitForReady()`, no casting through `unknown` to reach protected
members, and no raw locators in tests. Reads `harnessed.config.ts` for the harness
directory when one is present.
