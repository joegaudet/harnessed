---
name: harness
description: Create and use component harnesses for cross-environment testing. Use when creating harnesses, test fixtures for components, or route test objects.
---

# Harness

A harness is a class that lets a test drive a component the way a person would,
through methods named for what the component _does_. Tests state intent; the
harness owns the DOM wiring. The same harness runs under every driver.

Architecture and full API: the `@harnessed/core` README.

## Consumer-side rule

**If a component has a harness, callers must use it.** Never a raw
`page.getByRole(...)`, `page.locator(...)`, or `screen.getByRole(...)` for
something a harness covers.

Harness missing a method you need? **Add a public method to the harness.** Do not
work around it.

Banned:

- `(harness as unknown as { page }).page` — casting through `unknown` to reach a
  protected member.
- `screen.getByText(...)` in a test whose component has a harness.
- A raw locator in a step file.

`@harnessed/eslint-plugin` enforces all three.

## File placement and test-id naming

<!-- BEGIN GENERATED: placement -->
<!-- END GENERATED: placement -->

Add the root `data-testid` to the component if it is not there. Sub-element test
ids extend the host's: `{{WIDGET_EXAMPLE}}-label`, `{{WIDGET_EXAMPLE}}-hint`.

## Creating a component harness

Template: `examples/component-harness-template.ts`

- `@Harness({ host })` is required, and the host should be a `testId`, not copy.
- Element fields are `private accessor` and use `@ByRole` / `@ByLabel` /
  `@ByTestId` / `@ByText` / `@ByPlaceholder`.
- `@ChildHarness(HarnessClass)` for a nested harness.
- `this.self` when the host _is_ the control — a card that is itself a button has
  nothing inside it to click.
- `this.elementBy(selector)` when the selector is computed at call time (a table
  cell addressed by row and column). It keeps the harness's scope; a driver query
  would not.
- Public methods are behavioural — `signInAs`, `chooseByLabel`, `lineItems` — not
  element accessors.
- Screens that share a shape can extend an **abstract** base that carries the
  fields and methods; each subclass supplies only its own `@Harness({ host })`.

## Creating a route harness

Template: `examples/route-harness-template.ts`

- `RouteHarness<{ token: string }>` declares the path's params, so `goto()` is
  checked against the path rather than trusted.
- `$param` substitution works in the query string as well as the path, at every
  occurrence, URL-encoded.
- `waitForReady()` is required and must never be empty. `this.page.waitForSelector`
  is legitimate here, and only here.
- Compose screens with `@ChildHarness`.

## Element locator API

| Decorator              | Finds by                                  | Example                             |
| ---------------------- | ----------------------------------------- | ----------------------------------- |
| `@ByRole(role, opts?)` | ARIA role + name (+ `level` for headings) | `@ByRole('heading', { level: 1 })`  |
| `@ByTestId(id)`        | the test-id attribute                     | `@ByTestId('est-price')`            |
| `@ByLabel(text)`       | label text                                | `@ByLabel('Email')`                 |
| `@ByText(text)`        | visible text                              | `@ByText(/expired/)`                |
| `@ByPlaceholder(text)` | placeholder                               | `@ByPlaceholder('you@example.com')` |

Priority: `@ByRole` > `@ByTestId` > `@ByLabel` > `@ByText` > `@ByPlaceholder`.

Reach for `@ByTestId` when the accessible name is unstable (a button whose label
changes with its state) or absent (a decorative `<small>`, a money input in a
table cell).

Pass `{ global: true }` to bypass the host scope — for portals and overlays that
render outside the component's own subtree.

## Using it

Under Testing Library:

```ts
render(<LoginForm />)                 // render FIRST
const user = userEvent.setup()        // then set up
const form = new LoginFormHarness(dom({ user }))
await form.signInAs('ada@example.com')
```

Under Playwright:

```ts
const checkout = new CheckoutRoute(page)
await checkout.goto({ token })
await expect(checkout.total).toReadAs(/^\$/)
```

## Gotchas

1. **Render before `userEvent.setup()`.**
2. **Register `afterEach(cleanup)`** if your runner does not. A leaked previous
   tree makes strict single-target queries ambiguous. Or pass a `container`.
3. **Selection state comes from `aria-pressed`, never a CSS class.** Reading a
   class couples the test to styling — add the attribute to the component. It is
   the accessible signal as well as the queryable one.
4. **A control whose accessible name changes with its state needs a stable
   handle** — a `data-testid` plus a `data-*` state attribute the harness reads.
5. **`fill('')` clears; it does not type.**
6. **`isAbsent()` is how you ask whether something is missing.** It answers
   immediately, where `isVisible()` waits out the timeout first.
7. **`first()` is only correct when the matches genuinely are the same control
   rendered twice** (an action bar repeated above and below a form). It is not a
   fix for a query that accidentally matches two different things — scope that
   instead.
8. **`useDefineForClassFields` must stay `true`**, with `target: ES2022` and
   `ESNext.Decorators` in `lib`. Extend `@harnessed/core/tsconfig.json` to get
   all three. Add `harnessedDecorators()` from `@harnessed/core/vite` as the first
   Vite plugin, or `accessor` reaches the runtime unlowered and fails to parse.
