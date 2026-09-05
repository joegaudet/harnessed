# @harnessed-ts/playwright

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

### Patch Changes

- Updated dependencies
  - @harnessed-ts/core@0.2.0

## 0.1.0

First release.

Playwright driver, plus two things this setup earned: `createApiStubs`, for running
a browser suite with no backend, and `withWorld`, a scenario-scoped bag so BDD
steps stop sharing module-level state that breaks when a worker is reused.
