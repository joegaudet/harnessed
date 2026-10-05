---
'@harnessed-ts/eslint-plugin': minor
'@harnessed-ts/claude': minor
---

Harnesses speak in behaviours, never in the vocabulary of a test runner or the DOM.

**eslint-plugin.** Three new rules, all in `recommended` and `strict`:

- `no-runner-import-in-harness` (error): a harness may not import a runner or a driver — `@playwright/test`, `cypress`, `@testing-library/*`, `vitest`, `webdriverio`, `puppeteer`, `testcafe`, `@ember/test-helpers`, `qunit`, `chai`, and every `@harnessed-ts` package except `core`, `page`, and `route` — nor use the `document`, `window`, `cy`, `browser`, `$`, or `$$` globals (directly or through `globalThis`) outside a page's `waitForReady()`. `allow` takes exceptions.
- `harness-public-surface` (error): element fields (`@ByRole`, `@ByTestId`, `@ByLabel`, `@ByText`, `@ByPlaceholder`) must be private or protected; a public method may not return a `Query`, locator, element, or selector, nor take one in. A `@ChildHarness` may stay public.
- `behavioural-method-names` (warn): public harness methods named for a mechanic (`clickSubmit`) or a DOM noun (`submitButton`). Configurable with `verbs`, `nouns`, and `allow`.

`no-raw-locator-in-test` now also catches any member of Testing Library's `screen` (`screen.debug()` reads markup too) and `fireEvent`, its `within(…)`, the global `document`'s own queries (`querySelector`, `getElementById` and friends), and `cy.xpath`. Like the runner queries it already knew, these are resolved through scope and matched by import source: a local binding named `screen`, `within`, `fireEvent` or `document`, or a `screen` imported from anywhere but `@testing-library/*`, is left alone — though a locator method such as `getByRole` is still caught on any `screen`. `cy.xpath` is a Cypress query to `no-page-or-screen-in-harness` too.

These can fail a build that passed before: the two new errors are on by default in `recommended`.

**claude.** The harness rule and skill gain a "Speak in behaviours" section with the portability test, and `install` writes a new `.claude/rules/harness-tests.md`, path-scoped to test files.
