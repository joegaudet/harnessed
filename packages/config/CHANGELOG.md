# @harnessed-ts/config

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

### Patch Changes

- Updated dependencies
  - @harnessed-ts/core@0.2.0

## 0.1.0

First release.

Loads `harnessed.config.ts` from disk, via jiti, so the file can stay TypeScript
for callers that have no bundler — the ESLint plugin and the Claude CLI. Resolves
by walking up from the file being checked rather than from the working directory,
which is what makes it correct in a monorepo.
