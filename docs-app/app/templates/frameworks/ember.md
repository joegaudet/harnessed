# Ember

```bash
npm i -D @harnessed-ts/core @harnessed-ts/ember @harnessed-ts/qunit
npm i -D @testing-library/dom @testing-library/user-event
npm i -D @babel/plugin-proposal-decorators @babel/plugin-transform-typescript @babel/plugin-transform-class-static-block
```

Add `@harnessed-ts/core/babel` to the app's Babel config (see
[Required setup](../getting-started/installation.md#required-setup)), then build envs with `ember()`. Queries
resolve through the shared resolver. Clicks and fills go through
`@ember/test-helpers`; keys, hover, focus and selects through user-event, as in
the Testing Library driver. Every interaction returns once the app has settled.

```ts
// tests/test-helper.ts
import { install } from '@harnessed-ts/qunit'
install(QUnit)

// a rendering test
await render(<template><LoginForm /></template>)
const form = new LoginFormHarness(ember())
await form.signInAs('ada@example.com', 'hunter2')
await assert.harness(form.error).isAbsent()

// an application test: goto() drives the router
const checkout = new CheckoutPage(ember())
await checkout.goto({ token })
```

| Runner              | How                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ember-qunit         | as above; `assert.harness(x)` from `@harnessed-ts/qunit`                                                                                                                                                                                                                                                                                                                        |
| ember-exam          | use ember-exam's `start` in `test-helper` as usual; harnesses keep no state between tests                                                                                                                                                                                                                                                                                       |
| Vitest browser mode | [`ember-vitest`](https://github.com/NullVoxPopuli/ember-vitest)'s `renderingTest` / `applicationTest`, describe/it, and `chai.use(harnessedChai)` from `@harnessed-ts/chai`. An app built with Embroider needs two Vitest workarounds — see [`test-apps/ember-vite/vitest.config.mts`](https://github.com/joegaudet/harnessed/blob/main/test-apps/ember-vite/vitest.config.mts) |
| ember-mocha         | not supported: its last release depends on `@ember/test-helpers` 1.x. For BDD-style Ember tests, use Vitest browser mode as above                                                                                                                                                                                                                                               |

Classic and Embroider + Vite builds, Ember 5.12 and later.

Where Ember differs from the other drivers:

- **Queries start at the test's root element** (`#ember-testing`), for scoped and
  `{ global: true }` fields alike — not `document.body`, which also holds QUnit's
  report. Render portals (`{{in-element}}`, modal containers) inside it, or pass
  `ember({ root })`.
- **`isVisible()` is a layout check**, as in a browser driver: the tests run in a
  real browser.
- **The URL members need a router.** `goto()` works in application tests; in a
  rendering test, and before an application test's first visit, `currentUrl` and
  `assertPathname()` refuse at once rather than reading as `/`.

**Mocking:** `setupMocks(hooks)` and `mock(ember())` from `@harnessed-ts/ember/mock`; it sits on top of Mirage, so what no mock answers still reaches it — see [Mocking APIs](../mocking/mocking-apis.md).
