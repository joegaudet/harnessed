---
'@harnessed-ts/vitest-browser': minor
---

New package `@harnessed-ts/vitest-browser`: a driver for Vitest browser mode. Harnesses resolve in the page through the shared resolver and act through the provider's `userEvent`, so clicks and typing are real browser input — including inside same-origin frames under the Playwright provider. `@harnessed-ts/vitest-browser/matchers` registers the shared matchers with Vitest's `expect`.
