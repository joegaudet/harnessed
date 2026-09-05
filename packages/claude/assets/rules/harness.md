---
paths: ['{{HARNESS_DIR}}/**']
---

## Harness authoring

Full API and architecture: the `@harnessed/core` README. Procedural how-to
(placement, naming, templates): the `harness` skill.

### Required

- **`@Harness({ host })` on every concrete harness.** If the component has no
  test id on its root element, **add one** — never anchor on copy. Copy changes
  without warning and takes the harness with it. An abstract base may leave the
  host to its subclasses.
- **`waitForReady()` on every `RouteHarness`, and never empty.** An empty one
  satisfies the abstract member and silently removes the wait, so the failure
  lands somewhere unrelated later in the test.
- **Behavioural methods, not element access.** `chooseByLabel('Medium')`, not a
  public `cards` array. Element fields are `private`; the harness's public surface
  is what the component _does_.
- **Declare route params.** `RouteHarness<{ token: string }>` makes `goto()`
  checked against the path.

### Never

- **`page` or `screen` inside a harness.** Add an element field, a
  `@ChildHarness`, or use `this.elementBy(selector)` for a selector computed at
  call time. A route's `waitForReady()` does not need the driver either —
  `await this.self.waitFor('visible')`.
- **A CSS class as a state signal.** `className.includes('on')` couples the test
  to styling. Add `aria-pressed` / `aria-expanded` / `aria-selected` to the
  component instead.
- **`.first()` / `.nth(0)` to paper over a query that matches two different
  things.** Scope it instead.
- **Casting through `unknown`** to reach a protected member. Add a public method.

### Locator priority within a scoped host

`@ByRole` > `@ByTestId` > `@ByLabel` > `@ByText` > `@ByPlaceholder`.
