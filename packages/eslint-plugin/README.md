# @harnessed-ts/eslint-plugin

Nine rules that turn the harness authoring conventions into a gate. Harnesses
speak in behaviours, never in the vocabulary of a test runner or the DOM, so a
new variant of the app needs new harnesses, not new tests.

```js
import harnessed from '@harnessed-ts/eslint-plugin'
export default [harnessed.configs.recommended] // or .strict
```

- `no-page-or-screen-in-harness` — the one violation that silently destroys the
  abstraction. Exempts a page's `waitForReady()`.
- `require-host` — a concrete harness or page with no `@Harness({ host })`
- `require-wait-for-ready` — a page with a missing or empty readiness check
- `no-reach-through-cast` — `(harness as unknown as { page }).page`
- `no-raw-locator-in-test` — a raw runner or DOM query in a test where a harness
  should be used: `page.locator`/`getBy*`/`$`, Testing Library's `screen.*`,
  `within`, and `fireEvent`, `cy.get`/`cy.contains`/`cy.xpath`, Ember's
  `find` and selector-string actions, WebdriverIO's `$`/`$$`, TestCafe
  `Selector(…)`, `document.querySelector`
- `no-runner-import-in-harness` — a harness importing a runner or a driver, or
  using `document`, `window`, `cy`, `browser`, `$`, or `$$`. Only `@harnessed-ts/core`,
  `@harnessed-ts/page`, and `@harnessed-ts/route` are allowed from the harnessed
  scope, so a new driver is covered without a rule change. Exempts a page's
  `waitForReady()`; `allow` takes exceptions.
- `harness-public-surface` — a public element field, or a public method that
  returns a `Query`, locator, or element, or takes a selector in. A
  `@ChildHarness` may stay public: it is a harness.
- `behavioural-method-names` — a public harness method named for a mechanic
  (`clickSubmit`, `fillEmail`) or a DOM noun (`submitButton`) instead of intent.
  A warning in both configs; `verbs`, `nouns`, and `allow` tune it.
- `no-component-harness-in-test` — a test constructing a component harness
  directly instead of entering through a page. Runtime-agnostic: `testFiles`
  globs default to `*.spec.*`, `*.test.*`, `*.cy.*`, `*.steps.*`, and `steps/`;
  a file that calls `render()` or `mount()` is exempt. `strict` only.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
