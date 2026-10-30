# ESLint plugin

**`@harnessed-ts/eslint-plugin`** turns the authoring rules into a gate. Harnesses
speak in behaviours, never in the vocabulary of a test runner or the DOM: tests
depend only on harness and page public methods, so a new variant of the app (a
native build, say) needs new harnesses, not new tests.

```js
import harnessed from '@harnessed-ts/eslint-plugin'
export default [harnessed.configs.recommended]
```

ESLint 8.57 with a legacy `.eslintrc` works too. The eslintrc configs are
`legacy-recommended` and `legacy-strict`, and the rules are named under
`@harnessed-ts/`:

```json
{
  "extends": ["plugin:@harnessed-ts/legacy-recommended"]
}
```

or one rule at a time:

```json
{
  "plugins": ["@harnessed-ts"],
  "rules": { "@harnessed-ts/no-raw-locator-in-test": "error" }
}
```

| Rule                           | Catches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-page-or-screen-in-harness` | a harness reaching for the driver's own query API — `this.page`, a bare `page`'s queries (Puppeteer's `page.$`, Vitest browser's `page.getByRole`), `screen`, `cy.get`, Ember's `find`, WebdriverIO's `$`, TestCafe's `Selector` — which drops the scope chain and leaks the coupling it exists to contain. Exempts a page's `waitForReady()`.                                                                                                                                                                                                                                                                                                      |
| `require-host`                 | a concrete harness or page with no `@Harness({ host })` — otherwise a runtime throw in whichever test ran first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `require-wait-for-ready`       | a page with a missing or empty `waitForReady()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `no-reach-through-cast`        | `(harness as unknown as { page }).page`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `no-raw-locator-in-test`       | a raw query in a test that should go through a harness — `page.getByRole(…)`, `screen.getByText(…)`, Puppeteer's `page.$(…)`, `cy.get(…)` or `cy.xpath(…)`, Ember's `find(…)` or `click('.selector')`, `this.element.querySelector(…)`, WebdriverIO's `$(…)`, TestCafe's `Selector(…)`, any member of Testing Library's `screen` or `fireEvent`, its `within(…)`, `document.querySelector(…)` (a warning in `recommended`, an error in `strict`). Bare names (`find`, `$`, `Selector`, `screen`, `within`) are resolved through scope and matched by import source, so lodash's `find`, jQuery's `$`, or a test's own `screen` page are left alone. |
| `no-runner-import-in-harness`  | a harness importing a runner or driver (`@playwright/test`, `cypress`, `@testing-library/*`, `vitest`, any `@harnessed-ts` driver, …) or using `document`/`window`/`cy`/`browser`/`$`/`$$`. Exempts a page's `waitForReady()`; `allow` takes exceptions                                                                                                                                                                                                                                                                                                                                                                                             |
| `harness-public-surface`       | a public element field, or a public method that returns a `Query`/locator/element/selector or takes a selector in. A `@ChildHarness` may stay public: it is a harness                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `behavioural-method-names`     | a public harness method named for a mechanic (`clickSubmit`, `fillEmail`) or a DOM noun (`submitButton`, `rowLocator`) instead of intent. A warning: it judges names; `verbs`, `nouns`, and `allow` tune it                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `no-component-harness-in-test` | a test constructing a component harness directly instead of entering through a page. Runtime-agnostic (`testFiles` globs); exempts a file that renders the component itself. `strict` only.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `no-raw-intercept`             | a runner's own interception in a test — `page.route`, `cy.intercept`, `setRequestInterception`, `browser.mock`, `RequestMock()`, MSW's `setupServer` — where `mock(env)` should be used (a warning in `recommended`, an error in `strict`)                                                                                                                                                                                                                                                                                                                                                                                                          |
| `await-mock-install`           | a floating `.reply()`, `.use()` or `graphql.query()` on a harnessed mock: unawaited, a request fired straight after can go unanswered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**`@harnessed-ts/claude`** installs the authoring conventions for coding agents:

```bash
npm i -D @harnessed-ts/claude && npx @harnessed-ts/claude install
```

It writes `.claude/skills/harness/`, `.claude/rules/harness.md`, and
`.claude/rules/harness-tests.md` (path-scoped to harnesses and to tests), generating
the file-placement table from your repo's actual layout, and creates
`harnessed.config.ts` if it is missing. It also detects the test runners the repo
uses — Ember, Cypress, WebdriverIO, TestCafe, Puppeteer, Playwright, Vitest
browser mode, Testing Library, Gherkin — from the dependencies and config files of
the root and every workspace package, and documents only those: how a test builds
the env and asserts, with a worked example per runner (per adapter, for Gherkin).
Pass `--runners cypress,gherkin` to choose them yourself. Re-running refreshes the
docs, removes the examples of runners the repo no longer uses, and leaves your
config alone.
