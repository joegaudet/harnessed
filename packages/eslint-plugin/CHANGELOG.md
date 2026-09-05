# @harnessed/eslint-plugin

## 0.1.0

First release.

Five rules that make the harness authoring conventions a gate rather than a
convention: no `page`/`screen` inside a harness, a required `@Harness({ host })`, a
non-empty `waitForReady()`, no casting through `unknown` to reach protected
members, and no raw locators in tests. Reads `harnessed.config.ts` for the harness
directory when one is present.
