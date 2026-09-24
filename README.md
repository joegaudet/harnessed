# harnessed

One page-object API that runs under both Testing Library and Playwright.

A **harness** is a class that lets a test drive a component the way a person would,
through methods named for what the component _does_. Tests state intent; the
harness owns the DOM wiring. Write the harness once and it works in a fast jsdom
unit test and in a real browser.

```ts
@Harness({ host: testId('login-form') })
class LoginFormHarness extends ComponentHarness {
  @ByLabel('Email') private accessor email!: Query
  @ByLabel('Password') private accessor password!: Query
  @ByRole('button', { name: /sign in/i }) private accessor submit!: Query
  @ByTestId('login-error') private accessor errorLine!: Query

  async signInAs(email: string, password: string): Promise<void> {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }

  async error(): Promise<string | null> {
    if (await this.errorLine.isAbsent()) return null
    return this.errorLine.text()
  }
}
```

```ts
// jsdom, via Testing Library
render(<LoginForm />)
const form = new LoginFormHarness(dom({ user: userEvent.setup() }))
await form.signInAs('ada@example.com', 'hunter2')
expect(await form.error()).toBeNull()

// a real browser, via Playwright — the same harness class
const form = new LoginFormHarness(pw(page))
await form.signInAs('ada@example.com', 'hunter2')
await expect(form).toBeAbsent()
```

Inspired by [Angular CDK Component Harnesses][cdk],
[ember-test-fixture][etf], and [Playwright Page Object Models][pom].

[cdk]: https://angular.dev/guide/testing/component-harnesses-overview
[etf]: https://github.com/jayseo5953/ember-test-fixture
[pom]: https://playwright.dev/docs/pom

## Why

- Tests stop knowing about DOM structure, CSS classes, and internal state.
- Tests read as a list of things the component can do.
- One harness serves every level of the pyramid — no second set of selectors for
  the browser suite that drifts out of step with the first.

## Install

```bash
npm i -D @harnessed-ts/core

# plus the driver(s) you use
npm i -D @harnessed-ts/dom          # Testing Library / jsdom
npm i -D @harnessed-ts/playwright   # Playwright
npm i -D @harnessed-ts/page         # page objects: screens composed of harnesses
```

`@harnessed-ts/core` depends on neither driver. A jsdom-only project never resolves
Playwright, and vice versa.

### Required setup

Standard decorators and `accessor` fields are the authoring surface, and they need
two things.

**1. Three compiler options.** Extend the shipped config to get them:

```jsonc
// tsconfig.json
{
  "extends": "@harnessed-ts/core/tsconfig.json",
  // → target: ES2022, useDefineForClassFields: true, lib includes ESNext.Decorators
}
```

**2. A transform that lowers them.** No JavaScript runtime can parse `accessor`
yet, and Vite's default transform passes it through untouched. Add the plugin
first in the list:

```ts
import { harnessedDecorators } from '@harnessed-ts/core/vite'

export default defineConfig({
  plugins: [harnessedDecorators(), react()],
})
```

Both your Vite config and your Vitest config need it. Playwright's own transform
handles decorators already, so its config does not.

> Omitting either step fails at runtime, not at typecheck: every decorated field
> becomes a syntax error or silently loses its getter.

## Cross-driver guarantees

Every item below is backed by a spec in `packages/conformance` that runs, unchanged,
under each driver. A driver that disagrees with another fails the build — that
agreement is the whole reason the abstraction exists.

1. **Absence answers immediately.** `count()` and `isAbsent()` on something that is
   not on screen return straight away. They never wait out a timeout and never
   throw.
2. **Single-target operations are strict.** More than one match is an error naming
   the selector, raised at once — never a silent pick of the first.
3. **`role` selectors honour `level`.** `@ByRole('heading', { level: 1 })` picks the
   `h1` on a screen that also has an `h2`.
4. **`elementBy()` keeps the harness's scope.** A selector computed at call time is
   still scoped to the host, so a matching node elsewhere on the page is not found.
5. **`{ global: true }` escapes the scope, and only it does.** A portalled dialog is
   reachable from a global field and invisible to a scoped one.
6. **A page composes under its own scope.** A component harness or a page nested
   in a page with `@ChildHarness` inherits the page's scope chain, so a matching
   node elsewhere on the screen is not found.
7. **Readiness is one check, phrased one way.** `expectReady()` resolves once the
   page's `waitForReady()` does, and otherwise rejects naming the page —
   `<Page> did not become ready.` with the original failure as `cause`, or
   `<Page> did not become ready within <n>ms.` when an explicit `{ timeout }`
   elapsed first. `isReady()` answers `false` and never throws.
8. **Transitions hand back a ready page.** `transitionTo(NextPage)` constructs the
   next page in the same scope and awaits its readiness before returning it.
9. **A page constructs under every driver.** Only `goto()` and the URL members
   need a driver that can navigate; under one that cannot they fail at call time
   with `the "<driver>" driver cannot navigate`. `goto()` on a page with no `path`
   fails with `<Page> declares no path` before touching the driver.
10. **A frame is a scope boundary, crossed only by `frame()`.** A harness nested
    through a frame reads and drives the frame's document; a scoped query outside
    it never sees in; `{ global: true }` inside it stays in the frame's document;
    a frame marker on anything but an `<iframe>` rejects; and a page nested in a
    frame refuses its URL members with `<Page> is nested in a frame`. The dom
    driver enters same-origin frames only, and names the frame when it cannot.

Where the drivers genuinely cannot match, the difference is documented rather than
papered over:

- **`isVisible()`** is a computed-style check under jsdom, which computes no layout.
  A node covered by another element, or scrolled out of view, reads as visible
  there and hidden in a browser. Assert on absence or on state, not on visibility,
  when you want the same answer from both.
- **`check()` / `uncheck()`** need a real checkbox or radio under Playwright. For a
  non-native control, read `aria-checked` — which both drivers prefer when present.

## API

### Selectors

`testId('x')`, `role('button', { name: /save/i, level: 2 })`, `label('Email')`,
`text(/expired/)`, `placeholder('you@example.com')`. Each returns a `Selector`, a
plain data description of a query.

`frame(selector)` marks an `<iframe>`. Used as a host, the harness's `self` is the
iframe element and its fields resolve inside the frame's document:

```ts
@Harness({ host: frame(testId('payment-frame')) })
class PaymentFrame extends ComponentHarness {
  @ByRole('button', { name: 'Pay' }) private accessor pay!: Query
}
```

To reuse a harness written for the framed app itself, pass the iframe to
`@ChildHarness` instead — the child is unchanged:

```ts
@ChildHarness(CheckoutPage, { frame: testId('checkout-frame') }) accessor checkout!: CheckoutPage
```

Playwright enters cross-origin frames as well. The dom driver can only enter
same-origin ones; jsdom cannot load another origin's document.

### `Query`

A query descriptor — a scope chain plus a selector — not a resolved node. Nothing
is looked up until a method is called, which is why a field can be declared before
its component has rendered.

| Group        | Members                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| Interactions | `click` `fill` `clear` `check` `uncheck` `selectOption` `hover` `focus` `blur` `press` |
| Observations | `text` `inputValue` `attribute` `isVisible` `isEnabled` `isChecked` `selectedOptions`  |
| Waiting      | `waitFor(state, { timeout })`                                                          |
| Lists        | `count` `isAbsent` `nth` `first` `last` `each` `map` `filter` `texts`                  |

Every method takes an optional `{ timeout }`.

### `ComponentHarness`

`@Harness({ host })` declares the root element. Element fields are
`private accessor` and use `@ByRole` / `@ByTestId` / `@ByLabel` / `@ByText` /
`@ByPlaceholder`, scoped to the host. `@ChildHarness(Cls)` nests a harness and
passes the scope chain down; `@ChildHarness(Cls, { frame: testId('…') })` nests it
inside an iframe.

- `self` — the host element. Right when the host _is_ the control.
- `count` / `isAbsent` / `nth` / `first` / `last` / `each` / `map` / `filter` — for a
  component rendered several times on one screen.
- `elementBy(selector)` — a selector computed at call time, still scoped.
- `childHarness(Cls, { frame })` — the method form of `@ChildHarness`.

An **abstract** base may carry fields and methods with no host of its own; each
subclass supplies one. Resolution walks the prototype chain and the nearest
`@Harness` wins, so a subclass can also override a base's host.

### `PageHarness` (`@harnessed-ts/page`)

One test object per screen: what it is composed of, how to know it has arrived,
and — when it has a URL — how to get there. A page nests component harnesses and
other pages with `@ChildHarness`, and tests enter through it.

```ts
@Harness({ host: testId('page-checkout') })
class CheckoutPage extends PageHarness<{ token: string }> {
  override get path() {
    return '/checkout?token=$token'
  }

  @ChildHarness(CartHarness) accessor cart!: CartHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }

  async placeOrder(): Promise<ConfirmationPage> {
    await this.cart.checkout()
    return this.transitionTo(ConfirmationPage)
  }
}

// a real browser
const checkout = new CheckoutPage(pw(page))
await checkout.goto({ token })
const confirmation = await checkout.placeOrder()

// jsdom — the test renders the app, then waits for the page
render(<App />)
const rendered = new CheckoutPage(dom({ user: userEvent.setup() }))
await rendered.expectReady()
```

A page constructs under **every** driver: navigation is resolved lazily, so only
`goto()` and the URL members need a driver that can drive an address bar, and
under one that cannot (jsdom has no URL) they fail at call time with one readable
error.

`path` is optional. A page reached by URL overrides `get path()`; the type
parameter declares its params, so `goto()` is checked against the path rather
than trusted. Substitution is textual, so it works in the query string as well as
the path, at **every** occurrence, URL-encoded. A page reached by interaction
leaves `path` out, and `goto()` on it is a refusal, not a silent no-op.

`waitForReady()` runs behind `goto()` and `expectReady()` and must never be empty —
an empty one satisfies the abstract member and silently removes the wait, so the
failure lands somewhere unrelated later in the test. The usual body is one line
against the page's own host: `await this.self.waitFor('visible')`. With no
`{ timeout }` the wait is bounded only by what `waitForReady()` itself waits on;
an explicit one adds a second clock. `isReady()` is the non-throwing probe; pass
a short `{ timeout }`.

`transitionTo(NextPage)` is how an action returns the page it leads to: it
constructs `NextPage` with the same env and scope and awaits its readiness. A
shared app shell — nav, header, toasts — is an **abstract** page base carrying
those fields (`abstract class AppPage extends PageHarness`); each concrete page
extends it and supplies its own host.

Also provides `currentUrl`, `currentPathname`, `currentSearchParams`, and
`assertPathname()` — which waits, and compares the **pathname**, so it keeps
matching once the URL carries a query string.

`RouteHarness` in `@harnessed-ts/route` is the old name for this class. It is a
deprecated re-export for one release.

### Matchers

```ts
import '@harnessed-ts/dom/matchers' // or '@harnessed-ts/playwright/matchers'

await expect(card).toBeSelected()
await expect(banner).toBeAbsent()
await expect(price).toReadAs(/^\$/)
```

They take a target or a harness. `toReadAs` rather than `toHaveText` because
Playwright already ships a `toHaveText` for Locators.

### Configuration

```ts
// harnessed.config.ts
import { defineConfig } from '@harnessed-ts/core'

export default defineConfig({
  testIdAttribute: 'data-testid',
  defaultTimeout: 5000,
  layout: { components: 'src/components', pages: 'src/pages', harnesses: 'harness' },
  testIdPattern: { widget: 'ui-<kebab>', page: 'page-<kebab>' },
})
```

One place to declare these, read by everything that needs them.
`@harnessed-ts/eslint-plugin` and `@harnessed-ts/claude` load the file themselves — the
linter resolves it by walking up from the file being checked, so a monorepo and an
editor started anywhere both find the right one. `testIdAttribute` is pushed into
Testing Library and Playwright for you.

The runtime half is explicit, because your test setup already transforms
TypeScript and a bundler-free loader has no business running there:

```ts
// vitest setup file
import { applyConfig } from '@harnessed-ts/core'
import config from '../harnessed.config'

applyConfig(config)
```

## Keeping the conventions

**`@harnessed-ts/eslint-plugin`** turns the authoring rules into a gate:

```js
import harnessed from '@harnessed-ts/eslint-plugin'
export default [harnessed.configs.recommended]
```

| Rule                           | Catches                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-page-or-screen-in-harness` | a harness reaching for the driver's own query API, which drops the scope chain and leaks the coupling it exists to contain. Exempts a page's `waitForReady()`.                              |
| `require-host`                 | a concrete harness or page with no `@Harness({ host })` — otherwise a runtime throw in whichever test ran first                                                                             |
| `require-wait-for-ready`       | a page with a missing or empty `waitForReady()`                                                                                                                                             |
| `no-reach-through-cast`        | `(harness as unknown as { page }).page`                                                                                                                                                     |
| `no-raw-locator-in-test`       | a raw `page.getByRole(…)` in a test that should go through a harness (a warning in `recommended`, an error in `strict`)                                                                     |
| `no-component-harness-in-test` | a test constructing a component harness directly instead of entering through a page. Runtime-agnostic (`testFiles` globs); exempts a file that renders the component itself. `strict` only. |

**`@harnessed-ts/claude`** installs the authoring conventions for coding agents:

```bash
npm i -D @harnessed-ts/claude && npx @harnessed-ts/claude install
```

It writes `.claude/skills/harness/` and `.claude/rules/harness.md`, generating the
file-placement table from your repo's actual layout, and creates
`harnessed.config.ts` if it is missing. Re-running refreshes the docs and leaves
your config alone.

## Packages

| Package                       | What                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@harnessed-ts/core`          | `Query`, `Selector`, `ComponentHarness`, the decorators, the driver registry, `configure()`, the Vite plugin, matcher implementations |
| `@harnessed-ts/dom`           | Testing Library driver + matchers. No React dependency                                                                                |
| `@harnessed-ts/playwright`    | Playwright driver + matchers, `createApiStubs`, `withWorld`                                                                           |
| `@harnessed-ts/page`          | `PageHarness`                                                                                                                         |
| `@harnessed-ts/route`         | deprecated: re-exports `PageHarness` as `RouteHarness` for one release                                                                |
| `@harnessed-ts/eslint-plugin` | the six rules above                                                                                                                   |
| `@harnessed-ts/claude`        | authoring skill, rules, templates, and the install CLI                                                                                |

### Extras in `@harnessed-ts/playwright`

**`createApiStubs`** fulfils API requests from an in-memory object, so a browser
suite runs with no backend and no database — with a flag to send everything to the
real one instead. A green stubbed run is not a promise that the real endpoints
work; keep a separate check against a deployed environment.

**`withWorld`** adds a scenario-scoped bag for the pages a Gherkin scenario
builds up. Steps are separate functions, so the obvious place to put a
harness is a module-level `let` — which breaks the moment Playwright reuses a
worker.

## Adding a driver

`@harnessed-ts/core` holds a registry keyed by driver id and never imports a driver.
A driver supplies an env, 19 `Query` members, and a registration:

```ts
registerDriver('my-driver', (env, scope, selector) => new MyQuery(env, scope, selector))
```

Everything list-shaped — `nth`, `first`, `last`, `each`, `map`, `filter`, `texts`,
`isAbsent` — is inherited. Override `all()` if resolving a whole list at once is
cheaper for you than resolving each element (it is, for Testing Library; it is not
for Playwright, whose locators are descriptors). The registry lives on `globalThis`
under a `Symbol.for` key, so a graph that loads both the ESM and the CJS build
still has one registry.

If your driver can navigate, register that too and a page's `goto()` works
against it unchanged:

```ts
registerNavigation('my-driver', { goto, currentUrl, waitForUrl })
```

**A driver is done when it passes the conformance suite**, which is published for
exactly this purpose:

```bash
npm i -D @harnessed-ts/conformance
```

See [`@harnessed-ts/conformance`](packages/conformance/README.md) — one set of specs,
run by every driver, so a harness written against one works against yours.

## Requirements

Node ≥ 22.12, TypeScript ≥ 5.2, and — for `@harnessed-ts/playwright` —
`@playwright/test` ≥ 1.43. Published as ESM and CJS.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The gate is conformance parity: both
drivers run the same specs and must agree.

## License

MIT © Joe Gaudet, Jay Seo
