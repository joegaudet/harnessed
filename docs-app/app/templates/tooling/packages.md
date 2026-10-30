# Packages

| Package                        | What                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@harnessed-ts/core`           | `Query`, `Selector`, `ComponentHarness`, the decorators, the driver registry, `configure()`, the Vite plugin, matcher implementations                                                                                               |
| `@harnessed-ts/dom`            | Testing Library driver + matchers. No React dependency                                                                                                                                                                              |
| `@harnessed-ts/resolve`        | the shared selector resolver, plus an injectable build for remote drivers. A driver author's dependency                                                                                                                             |
| `@harnessed-ts/playwright`     | Playwright driver + matchers, `withMocks`, and the deprecated `createApiStubs` and `withWorld`                                                                                                                                      |
| `@harnessed-ts/ember`          | Ember driver over `@ember/test-helpers`: rendering and application tests                                                                                                                                                            |
| `@harnessed-ts/vitest-browser` | Vitest browser mode driver + matchers: in-page resolution, provider-native events                                                                                                                                                   |
| `@harnessed-ts/puppeteer`      | Puppeteer driver + matchers over the injected resolver; cross-origin frames                                                                                                                                                         |
| `@harnessed-ts/webdriverio`    | WebdriverIO driver + matchers over the injected resolver; BiDi and Classic, cross-origin frames                                                                                                                                     |
| `@harnessed-ts/cypress`        | Cypress driver: the `cy.harness` bridge and `cy.visitPage`, e2e and component testing                                                                                                                                               |
| `@harnessed-ts/testcafe`       | TestCafe driver over the injected resolver                                                                                                                                                                                          |
| `@harnessed-ts/nightwatch`     | Nightwatch driver over the injected resolver; Nightwatch and Mocha runners, component testing, cross-origin frames                                                                                                                  |
| `@harnessed-ts/angular`        | Angular driver: every action settles at `whenStable()`; TestBed fixtures or a bootstrapped app, router navigation                                                                                                                   |
| `@harnessed-ts/storybook`      | `harnessed()` for Storybook's preview: a harness in every play function, each method a step, the matchers on its `expect`; `StoryPage` opens stories as fixtures; `/ember` renders Ember stories and settles after each interaction |
| `@harnessed-ts/gherkin`        | Gherkin: a scenario-scoped world, a typed page registry and `{page}`; adapters for playwright-bdd, cucumber-js, Cypress cucumber, ember-cli-yadda and Nightwatch                                                                    |
| `@harnessed-ts/qunit`          | `assert.harness(x)` checks for QUnit and ember-qunit                                                                                                                                                                                |
| `@harnessed-ts/chai`           | `expect(x).to.be.absent` and friends for Chai: Mocha, Cypress, WebdriverIO                                                                                                                                                          |
| `@harnessed-ts/page`           | `PageHarness`                                                                                                                                                                                                                       |
| `@harnessed-ts/mock`           | API mocking: the handler model, response builders, API harnesses, factories, OpenAPI and GraphQL validation, HAR, MSW import; each driver's `/mock` entry registers its transport                                                   |
| `@harnessed-ts/route`          | deprecated: re-exports `PageHarness` as `RouteHarness` for one release                                                                                                                                                              |
| `@harnessed-ts/eslint-plugin`  | the eleven rules in [ESLint plugin](eslint-plugin.md)                                                                                                                                                                               |
| `@harnessed-ts/claude`         | authoring skill, rules, templates, and the install CLI                                                                                                                                                                              |

## Extras in `@harnessed-ts/playwright`

**`createApiStubs`** is deprecated: it is now built on [`mock()`](../mocking/mocking-apis.md),
which does the same under every runner, and is removed in the next minor. It
fulfils API requests from an in-memory object, so a browser suite runs with no
backend — with a flag to send everything to the real one instead.

**`withMocks(test)`** (from `@harnessed-ts/playwright/mock`) adds a `mocks`
fixture: the page's mock, ended after the test.

**`withWorld`** (from `@harnessed-ts/playwright/bdd`) is deprecated: it moved to
`@harnessed-ts/gherkin/playwright-bdd` — see [Gherkin](../storybook-and-bdd/gherkin.md).
