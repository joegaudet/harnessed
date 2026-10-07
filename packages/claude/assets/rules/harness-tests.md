---
paths: ['**/*.spec.*', '**/*.test.*', '**/*.cy.*', '**/*.steps.*', '**/steps/**']
---

## Tests speak in behaviours

A test constructs an env, then its pages, and calls only their public methods.
That is what lets a new variant of the app — a native iOS build, say — reuse
every test unchanged with new harnesses behind it.

- **Import a driver only to build the env** (`pw(page)`, `dom({ user })`,
  `cy.harness(…)`). Never a driver's or runner's DOM helper: no `screen`,
  `within`, `fireEvent`, `page.locator(…)` / `page.getBy*(…)` / `page.$(…)`,
  `cy.get(…)` / `cy.contains(…)`, Ember's `find(…)` or `click('.selector')`,
  WebdriverIO's `$(…)` / `browser.$(…)`, TestCafe's `Selector(…)`, or
  `document.querySelector(…)`.
- **No selectors, elements, or key names in a test.** If the test needs to say
  something no harness method says, add a public method to the harness, named
  for what the user means — `checkout.placeOrder()`, not a click on a button.
- **Enter through a page.** Construct a component harness directly only in a test
  that renders the component itself (`render(<Form />)`, `cy.mount(…)`).
- **Never cast through `unknown`** to reach a harness's internals.

The test for a line of a test: if this app were rebuilt natively, would it still
read correctly? If not, the line belongs in a harness.

`@harnessed-ts/eslint-plugin` enforces this with `no-raw-locator-in-test` (in the
directories its `testDirs` option names: `tests/`, `test/`, `e2e/`, `cypress/`,
and `__tests__/` by default) and `no-component-harness-in-test`.
