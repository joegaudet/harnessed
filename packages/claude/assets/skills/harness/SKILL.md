---
name: harness
description: Create and use component harnesses and page objects for cross-environment testing. Use when creating harnesses, test fixtures for components, or pages.
---

# Harness

A harness is a class that lets a test drive a component the way a person would,
through methods named for what the component _does_. Tests state intent; the
harness owns the DOM wiring. The same harness runs under every driver.

A **page** is a harness one level up: a screen composed of component harnesses
and other pages, that knows when it has arrived and, when it has a URL, how to
get there. Tests enter through a page.

Architecture and full API: the `@harnessed-ts/core` README.

## Consumer-side rule

**If a component has a harness, callers must use it.** Never a raw
`page.getByRole(...)`, `page.locator(...)`, or `screen.getByRole(...)` for
something a harness covers.

Harness missing a method you need? **Add a public method to the harness.** Do not
work around it.

**Tests enter through a page.** Construct a component harness directly only in a
test that renders the component itself (`render(<Form />)` / `cy.mount`). An
end-to-end test, a spec, or a step file constructs a page and reaches the
component through it.

Banned:

- `(harness as unknown as { page }).page` — casting through `unknown` to reach a
  protected member.
- `screen.getByText(...)` in a test whose component has a harness.
- A raw locator in a step file.
- `new CartHarness(...)` in a spec or step file that has no page to go through.

`@harnessed-ts/eslint-plugin` enforces all four.

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
- Components that share a shape can extend an **abstract** base that carries the
  fields and methods; each subclass supplies only its own `@Harness({ host })`.

## Creating a page

Template: `examples/page-harness-template.ts`

- `PageHarness` from `@harnessed-ts/page`. `@Harness({ host })` is required, and
  the host is the page's root test id.
- `path` is optional. Override `get path()` for a page reached by URL; leave it
  out for one reached by interaction. `PageHarness<{ token: string }>` declares
  the path's params, so `goto()` is checked against the path rather than trusted.
  `$param` substitution works in the query string as well as the path, at every
  occurrence, URL-encoded.
- `waitForReady()` is required and must never be empty. Usually one line:
  `await this.self.waitFor('visible')`. It runs behind `goto()` and
  `expectReady()`; `isReady()` is the non-throwing probe.
- An action that leads to another page returns it:
  `return this.transitionTo(NextPage)` constructs the next page in the same
  scope and awaits its readiness.
- Compose component harnesses **and** other pages with `@ChildHarness`.
- A shared app shell (nav, header, toasts) is an **abstract** page base carrying
  those fields; each concrete page extends it and supplies its own host.
- A page constructs under every driver. Only `goto()` and the URL members
  (`currentUrl`, `assertPathname`, …) need one that can navigate.

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

Under Testing Library, a component test renders the component and drives its
harness; a page test renders the app, then waits for the page:

```ts
render(<LoginForm />)                 // render FIRST
const user = userEvent.setup()        // then set up
const form = new LoginFormHarness(dom({ user }))
await form.signInAs('ada@example.com')

render(<App />)
const login = new LoginPage(dom({ user: userEvent.setup() }))
await login.expectReady()
const dashboard = await login.signIn('ada@example.com') // returns DashboardPage
```

Under Playwright, enter through the page's URL:

```ts
const checkout = new CheckoutPage(pw(page))
await checkout.goto({ token })
await expect(checkout.total).toReadAs(/^\$/)
const confirmation = await checkout.placeOrder()
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
   `ESNext.Decorators` in `lib`. Extend `@harnessed-ts/core/tsconfig.json` to get
   all three. Add `harnessedDecorators()` from `@harnessed-ts/core/vite` as the first
   Vite plugin, or `accessor` reaches the runtime unlowered and fails to parse.
