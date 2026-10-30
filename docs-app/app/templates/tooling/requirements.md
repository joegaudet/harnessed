# Requirements

Node ≥ 22.12 (≥ 22.19 for `@harnessed-ts/webdriverio`, WebdriverIO 10's own floor)
and TypeScript ≥ 5.2. Published as ESM and CJS. Each driver's runner is a peer
dependency, with these floors:

| Package                        | Peer floor                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `@harnessed-ts/dom`            | `@testing-library/dom` ≥ 10, `@testing-library/user-event` ≥ 14                                                             |
| `@harnessed-ts/playwright`     | `@playwright/test` ≥ 1.43                                                                                                   |
| `@harnessed-ts/ember`          | `@ember/test-helpers` ≥ 5 (Ember 5.12 and later), `@testing-library/dom` ≥ 10, `@testing-library/user-event` ≥ 14           |
| `@harnessed-ts/cypress`        | `cypress` ≥ 13, `@testing-library/dom` ≥ 10, `@testing-library/user-event` ≥ 14                                             |
| `@harnessed-ts/webdriverio`    | `webdriverio` ≥ 10                                                                                                          |
| `@harnessed-ts/vitest-browser` | `vitest` ≥ 4, `@testing-library/dom` ≥ 10                                                                                   |
| `@harnessed-ts/puppeteer`      | `puppeteer` ≥ 24                                                                                                            |
| `@harnessed-ts/testcafe`       | `testcafe` ≥ 3                                                                                                              |
| `@harnessed-ts/nightwatch`     | `nightwatch` ≥ 3                                                                                                            |
| `@harnessed-ts/angular`        | `@angular/core`, `@angular/common`, `@angular/router` ≥ 21, `@testing-library/dom` ≥ 10, `@testing-library/user-event` ≥ 14 |
| `@harnessed-ts/gherkin`        | the adapter's runner: `@cucumber/cucumber` ≥ 10, `yadda` ≥ 3, …                                                             |
| `@harnessed-ts/core/babel`     | Babel ≥ 7.24 < 8, with the decorator and TypeScript plugins                                                                 |
| `@harnessed-ts/qunit`, `chai`  | `qunit` ≥ 2.19, `chai` ≥ 4                                                                                                  |
