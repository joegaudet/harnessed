---
paths: ['{{HARNESS_DIR}}/**']
---

## Harness authoring

Full API and architecture: the `@harnessed-ts/core` README. Procedural how-to
(placement, naming, templates): the `harness` skill.

### Speak in behaviours

A harness is the one place a test's vocabulary meets a driver's. Tests depend on
nothing but harness and page public methods, so a new variant of the app — a
native iOS build, say — needs new harnesses, not new tests.

**The portability test:** if this app were rebuilt natively, would this method's
name, parameters and return value still make sense unchanged? If not, it belongs
inside the harness.

- **Name methods for user intent or the domain, not mechanics.** `submit()`,
  `signIn(email)`, `chooseCard('Medium')`, `errorMessage()` — not `clickSubmit()`,
  `fillEmailInput()`, `getErrorElement()`.
- **Parameters and returns are domain values, or other harnesses and pages.**
  Never a `Query`, a selector, an element, a locator, a key name (`'Enter'`), or
  CSS. A `@ChildHarness` may be public: it is a harness, so it speaks in
  behaviours too.
- **No runner or driver inside a harness.** Import `@harnessed-ts/core`,
  `@harnessed-ts/page`, other harnesses, and the app's own types — never
  `@playwright/test`, `cypress`, `@testing-library/*`, `vitest`, or a
  `@harnessed-ts` driver package. No `document`, `window`, `cy`, `browser`, `$`.
- **Tests never import a driver or runner DOM helper.** A test imports a driver
  only to build the env, then constructs pages and calls their public methods.

`@harnessed-ts/eslint-plugin` enforces this: `no-runner-import-in-harness`,
`harness-public-surface`, `behavioural-method-names` (a warning, since it judges
names), and `no-raw-locator-in-test` on the test side.

### Required

- **`@Harness({ host })` on every concrete harness.** If the component has no
  test id on its root element, **add one** — never anchor on copy. Copy changes
  without warning and takes the harness with it. An abstract base may leave the
  host to its subclasses.
- **`waitForReady()` on every `PageHarness`, and never empty.** An empty one
  satisfies the abstract member and silently removes the wait, so the failure
  lands somewhere unrelated later in the test.
- **Behavioural methods, not element access.** `chooseByLabel('Medium')`, not a
  public `cards` array. Element fields are `private`; the harness's public surface
  is what the component _does_.
- **Declare page params.** `PageHarness<{ token: string }>` makes `goto()`
  checked against the path. Leave `path` out for a page reached by interaction.
- **An action that leads to another page returns it**, via
  `this.transitionTo(NextPage)`.

### Never

- **`page` or `screen` inside a harness.** Add an element field, a
  `@ChildHarness`, or use `this.elementBy(selector)` for a selector computed at
  call time. A page's `waitForReady()` does not need the driver either —
  `await this.self.waitFor('visible')`.
- **A CSS class as a state signal.** `className.includes('on')` couples the test
  to styling. Add `aria-pressed` / `aria-expanded` / `aria-selected` to the
  component instead.
- **`.first()` / `.nth(0)` to paper over a query that matches two different
  things.** Scope it instead.
- **Casting through `unknown`** to reach a protected member. Add a public method.

### Locator priority within a scoped host

`@ByRole` > `@ByTestId` > `@ByLabel` > `@ByText` > `@ByPlaceholder`.
