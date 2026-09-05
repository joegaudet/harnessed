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
npm i -D @harnessed-ts/route        # one test object per URL
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
passes the scope chain down.

- `self` — the host element. Right when the host _is_ the control.
- `count` / `isAbsent` / `nth` / `first` / `last` / `each` / `map` / `filter` — for a
  component rendered several times on one screen.
- `elementBy(selector)` — a selector computed at call time, still scoped.
- `childHarness(Cls)` — the method form of `@ChildHarness`.

An **abstract** base may carry fields and methods with no host of its own; each
subclass supplies one. Resolution walks the prototype chain and the nearest
`@Harness` wins, so a subclass can also override a base's host.

### `RouteHarness` (`@harnessed-ts/route`)

One test object per URL. Takes an env like every other harness and runs on the
driver's **navigation capability**, so any driver that can drive an address bar
gets routes — and one that cannot (jsdom has no URL) says so in a single readable
error at construction, rather than failing somewhere inside the first `goto()`.

```ts
@Harness({ host: testId('stage') })
class CheckoutRoute extends RouteHarness<{ token: string }> {
  get path() {
    return '/checkout?token=$token'
  }

  @ChildHarness(CartHarness) accessor cart!: CartHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}

await new CheckoutRoute(pw(page)).goto({ token })
```

The type parameter declares the path's params, so `goto()` is checked against the
path rather than trusted. Substitution is textual, so it works in the query string
as well as the path, at **every** occurrence, URL-encoded.

`waitForReady()` runs automatically after `goto()` and must never be empty — an
empty one satisfies the abstract member and silently removes the wait, so the
failure lands somewhere unrelated later in the test. The usual body is one line
against the route's own host: `await this.self.waitFor('visible')`.

Also provides `currentUrl`, `currentPathname`, `currentSearchParams`, and
`assertPathname()` — which waits, and compares the **pathname**, so it keeps
matching once the URL carries a query string.

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
  layout: { components: 'src/components', screens: 'src/screens', harnesses: 'harness' },
  testIdPattern: { widget: 'ui-<kebab>', screen: 'screen-<kebab>' },
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

| Rule                           | Catches                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-page-or-screen-in-harness` | a harness reaching for the driver's own query API, which drops the scope chain and leaks the coupling it exists to contain. Exempts a route's `waitForReady()`. |
| `require-host`                 | a concrete harness with no `@Harness({ host })` — otherwise a runtime throw in whichever test ran first                                                         |
| `require-wait-for-ready`       | a route with a missing or empty `waitForReady()`                                                                                                                |
| `no-reach-through-cast`        | `(harness as unknown as { page }).page`                                                                                                                         |
| `no-raw-locator-in-test`       | a raw `page.getByRole(…)` in a test that should go through a harness (a warning in `recommended`, an error in `strict`)                                         |

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
| `@harnessed-ts/route`         | `RouteHarness`                                                                                                                        |
| `@harnessed-ts/eslint-plugin` | the five rules above                                                                                                                  |
| `@harnessed-ts/claude`        | authoring skill, rules, templates, and the install CLI                                                                                |

### Extras in `@harnessed-ts/playwright`

**`createApiStubs`** fulfils API requests from an in-memory object, so a browser
suite runs with no backend and no database — with a flag to send everything to the
real one instead. A green stubbed run is not a promise that the real endpoints
work; keep a separate check against a deployed environment.

**`withWorld`** adds a scenario-scoped bag for the route harnesses a Gherkin
scenario builds up. Steps are separate functions, so the obvious place to put a
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

If your driver can navigate, register that too and `@harnessed-ts/route` works
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

Node ≥ 22.12, TypeScript ≥ 5.2. Published as ESM and CJS.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The gate is conformance parity: both
drivers run the same specs and must agree.

## License

MIT © Joe Gaudet, Jay Seo
