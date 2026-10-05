# @harnessed-ts/gherkin

Gherkin support for [harnessed](https://github.com/joegaudet/harnessed#readme)
harnesses: a scenario-scoped world for the pages a scenario builds up, a typed
page registry, and a `{page}` parameter type that matches only registered
names, so a typo in a feature fails at step matching.

```ts
import { definePages, pageParameter } from '@harnessed-ts/gherkin'

export const pages = definePages({ checkout: CheckoutPage })
defineParameterType(pageParameter(pages)) // the runner's own defineParameterType
```

One adapter per runner gives the world a scenario's lifetime:

| Import                                 | Runner                                  | Gives you                      |
| -------------------------------------- | --------------------------------------- | ------------------------------ |
| `@harnessed-ts/gherkin/playwright-bdd` | playwright-bdd                          | `withWorld`, a `world` fixture |
| `@harnessed-ts/gherkin/cucumber`       | cucumber-js                             | `HarnessedWorld`               |
| `@harnessed-ts/gherkin/cypress`        | @badeball/cypress-cucumber-preprocessor | `cypressWorld`                 |
| `@harnessed-ts/gherkin/yadda`          | ember-cli-yadda                         | `yaddaWorld`, `pageDictionary` |

Each runner is an optional peer dependency; install the one you use. Setup for
each, with examples: [Using with Gherkin](https://github.com/joegaudet/harnessed#using-with-gherkin).

MIT © Joe Gaudet, Jay Seo
