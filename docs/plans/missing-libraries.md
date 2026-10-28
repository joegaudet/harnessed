# Plan: Vue, Svelte, Angular, Solid, Bun test, node:test, and Nightwatch

Status: draft · Branch: `claude/eloquent-thompson-txmnzj` · Base: `main` @ `b9cb567` (0.6.0)

## Goal

The site's hero illustration still draws eight boxes dashed ("not yet"). This plan
turns seven of them solid:

- UI frameworks: **Vue, Svelte, Angular, Solid**
- unit runners: **Bun test, node:test**
- e2e: **Nightwatch**

Detox stays dashed (see [Follow-up: Detox](#follow-up-detox)).

The bar is unchanged from the multi-runner plan: **conformance parity**. Each new
library runs the whole `@harnessed-ts/conformance` catalog (guarantees 1–13 plus
`pageSpecs`, and `urlSpecs` where the driver navigates) with no opt-outs, on every
PR. For a UI framework, "supported" means the README's UI-frameworks rule: a
fixture written in that framework, held to the React fixture by a parity test, and
conformance runs against it.

Each phase updates the README, its package README, and `docs/site/` (hero box, runner
table and badge, setup `<details>`) as part of its definition of done.

## Decisions (from the clarifying round)

| #   | Topic                 | Decision                                                                                                                                                |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope                 | UI frameworks, unit runners, and Nightwatch. Detox is out                                                                                               |
| 2   | Order                 | Easiest first: unit runners → Vue → Solid → Svelte → Nightwatch → Angular                                                                               |
| 3   | Release               | One coordinated **0.7.0** through a `next` integration branch                                                                                           |
| 4   | Conformance bar       | Capability tags were picked for Detox. Detox is out, so they are **deferred** with it (decision 29). Full catalog, no opt-outs                          |
| 5   | Fixture home          | `test-apps/<framework>`, a private Vite app each, with its own `serve:fixture`, like `ember-vite`                                                       |
| 6   | Framework runners     | All four for each port: dom + that framework's Testing Library, Playwright e2e, Vitest browser mode, Cypress component testing                          |
| 7   | Playwright layout     | One `test-apps/playwright-frameworks` config, one project and one `webServer` per port                                                                  |
| 8   | Ember Playwright      | `playwright-ember` stays as it is                                                                                                                       |
| 9   | Vue                   | 3.5+. `<Teleport>` for the portal                                                                                                                       |
| 10  | Svelte                | 5 only (runes). The portal is a `mount()` into `document.body`                                                                                          |
| 11  | Angular build         | `@analogjs/vite-plugin-angular`, with `harnessedDecorators()` scoped to harness and page files                                                          |
| 12  | Angular floor         | Latest LTS and up, zoneless                                                                                                                             |
| 13  | Angular driver        | Build **`@harnessed-ts/angular`**, mirroring `ember`: each action awaits `whenStable()`                                                                 |
| 14  | Angular CDK harnesses | A README note comparing them with `@angular/cdk/testing`. No interop                                                                                    |
| 15  | Solid portal          | Use `<Portal>` as it is and document its wrapper `<div>`                                                                                                |
| 16  | Solid in Cypress CT   | Skipped. Solid's row shows — with a footnote                                                                                                            |
| 17  | node:test DOM         | jsdom through `global-jsdom`                                                                                                                            |
| 18  | Bun DOM               | happy-dom through `@happy-dom/global-registrator`                                                                                                       |
| 19  | Decorator loading     | Ship `@harnessed-ts/core/register` (`node --import`) and `@harnessed-ts/core/bun` (a `bunfig.toml` preload), both lowering through esbuild like `/vite` |
| 20  | node:test assertions  | `@harnessed-ts/chai`. No new package                                                                                                                    |
| 21  | Bun matchers          | A new `@harnessed-ts/dom/matchers/bun` entry: `expect.extend` from `bun:test`, plus its `Matchers` types                                                |
| 22  | Runtime floors        | Node 22.12+ (unchanged), Bun 1.2+                                                                                                                       |
| 23  | Nightwatch actions    | The injected resolver through `browser.execute`, then actions on the underlying selenium-webdriver `WebElement` and Actions API                         |
| 24  | Shared WebDriver code | Extract webdriverio's realm and page-script code into `@harnessed-ts/resolve/webdriver` first                                                           |
| 25  | Nightwatch browsers   | Chrome and Firefox                                                                                                                                      |
| 26  | Nightwatch extras     | **Both** component testing (`@nightwatch/react`, `@nightwatch/vue`) and a Gherkin adapter (`@harnessed-ts/gherkin/nightwatch`)                          |
| 27  | Nightwatch assertions | `@harnessed-ts/chai`, under Nightwatch's own runner and under Mocha                                                                                     |
| 28  | Detox                 | A follow-up section here. Its hero box stays dashed                                                                                                     |
| 29  | Capability tags       | Deferred with Detox                                                                                                                                     |
| 30  | CI                    | Every new job required on every PR, through `conformance-driver.yml`                                                                                    |

## Non-goals

- Detox and React Native (see the follow-up).
- Vue 2, Svelte 4, and Angular with zone.js.
- Interop with Angular CDK harnesses.
- Solid under Cypress component testing.
- Demo GIFs for the new frameworks. `test-apps/demos` stays React and Ember.
- New Gherkin adapters other than Nightwatch's.

## What already exists and gets reused

- **Selectors are data.** `packages/core/src/selector.ts` doesn't know about any
  framework, so none of the four frameworks needs core changes.
- **Parity tooling is exported.** `fixtureTree`, `fixtureTrees`, `VIEWS`, and
  `viewSearch` from `@harnessed-ts/conformance` are what the Glimmer parity test
  (`test-apps/ember-vite/tests/conformance/fixture-parity-test.gts`) uses. Each
  new port copies that test's shape.
- **The dom driver runs anywhere.** `vitest` is an optional peer of
  `@harnessed-ts/dom`, and only `/matchers` imports it. The specs use the
  browser-safe `specs/assert.ts`, not `node:assert`.
- **Injected resolution.** `@harnessed-ts/resolve/inject` already powers
  webdriverio, puppeteer and testcafe.
- **CI.** Each new job is one `conformance-<name>.yml` calling the reusable
  `conformance-driver.yml`.

## Phases

Every phase follows the TDD rhythm. First wire the conformance runner and watch it go
**red**: the driver, port, or loader doesn't exist yet. Then build until it is green.
Each phase's definition of done:

- its CI job, required
- its package README (if it adds a package)
- its root README section, matrix row, and UI-frameworks row (for a framework)
- `docs/site/` updated in the same PR, using that phase's row in
  [Marketing site](#marketing-site), and the PR template's Website box ticked
- `claude` detection and the `eslint-plugin` patterns for that library (Phase 7 lists them;
  each lands with its library, not at the end)
- a changeset
- the gate (`pnpm lint`, `format:check`, `typecheck`, `build`, `test`) and
  `scripts/verify-like-ci.sh`, with its job list kept in step with `ci.yml`

### Phase 0: Foundations

| Step | Work                                                                                                                                                                                                                                                                             | Test first                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0.1  | Create the `next` branch from `main`. Point PR CI at it too                                                                                                                                                                                                                      | n/a                                                                                                                            |
| 0.2  | `@harnessed-ts/core/register`: a `module.register` load hook that lowers `accessor` and 2023-11 decorators with esbuild (already an optional peer of core) in files matching an `include` (same default globs as `/babel`), and leaves everything else to Node's own stripping   | A node:test file whose harness uses `accessor` fails to load without `--import @harnessed-ts/core/register` and passes with it |
| 0.3  | `@harnessed-ts/core/bun`: a `Bun.plugin` `onLoad` doing the same, registered through `preload` in `bunfig.toml`. Spike first: if Bun 1.2 already lowers `accessor` correctly, this becomes a no-op entry that only checks the Bun version                                        | The same harness under `bun test`, red without the preload                                                                     |
| 0.4  | Extract webdriverio's `realm.ts` and `page-script.ts` into `@harnessed-ts/resolve/webdriver`. The code only needs WebDriver's `execute` and frame switching, behind a small `WebDriverLike` interface that each driver adapts                                                    | Refactor: `conformance-webdriverio` (BiDi and Classic) stays green                                                             |
| 0.5  | A `parityTest(render: (url) => Promise<Element>)` helper in conformance that loops over `VIEWS` and compares `fixtureTree(stage)` with `fixtureTrees`, runner-agnostic (it takes `it` and `deepEqual`). Port the Ember parity test onto it                                       | Refactor: the Ember parity test stays green. A deliberate drift in a scratch port goes red                                     |
| 0.6  | `test-apps/playwright-frameworks` skeleton: `testDir` points at `packages/conformance/specs` like `playwright-ember`, with an empty `projects` list that each framework phase adds to. Ports in the 5191–5194 range                                                              | n/a                                                                                                                            |
| 0.7  | **Site-sync check** (`scripts/site-sync.test.mjs`, run by `pnpm test`): every `conformance-*.yml` workflow has a badge in `docs/site/index.html`'s runner table, and every hero label marked `todo` has no conformance workflow behind it. See [Marketing site](#marketing-site) | Mark Vue's box solid with no workflow behind it, then add a workflow with no badge. Both go red                                |

### Phase 1: node:test and Bun test

These are independent of each other and can run in parallel.

**node:test** (`test-apps/node-test`):

- `node --test --import global-jsdom/register --import @harnessed-ts/core/register`.
- `@testing-library/react` renders the React fixture the same way `run.dom.test.tsx`
  does. JSX in `.tsx` is lowered by the register hook too, so no extra loader.
- Registers `specs` and `pageSpecs` through `node:test`'s `describe`/`it`.
- **Assertions:** `@harnessed-ts/chai`.
- **Risk:** `@testing-library/dom`'s `waitFor` only recognises Jest fake timers. A test
  that uses `mock.timers` from `node:test` can hang a wait. Document it, and add a
  driver spec that runs with real timers so the guarantee is still proven.

**Bun test** (`test-apps/bun-test`):

- `bunfig.toml` preloads `@happy-dom/global-registrator` and `@harnessed-ts/core/bun`.
- The same catalog, through `bun:test`.
- `@harnessed-ts/dom/matchers/bun` registers `toBeSelected`, `toBeAbsent`, and
  `toReadAs`, and augments `bun:test`'s `Matchers` types. A matchers spec mirrors
  `matchers.dom.test.tsx`.
- **Risk:** this is the dom driver's first run on happy-dom. Accessible-name
  computation, `srcdoc` iframes (guarantee 10), and `boundingBox()` (12) are the
  likely gaps. Each gap gets fixed in the dom driver or the resolver, **or** the
  phase stops and asks. With capability tags deferred, there is no opt-out. A real
  gap means either a fix or a decision to switch Bun to jsdom.
- CI installs Bun with `oven-sh/setup-bun`, pinned to a version, plus a 1.2
  floor job.

**README.** "Using with node:test" and "Using with Bun" sections, with matrix rows.
**Site.** The Bun test and node:test hero boxes go solid, plus runner table rows.

### Phase 2: Vue (the template for every port)

Vue goes first among the frameworks because it is the least surprising, so it sets the
shape the other three copy.

**Port** (`test-apps/vue`, Vite + `@vitejs/plugin-vue`, `harnessedDecorators()` first):

- `LoginForm`, `CardGrid`, `PortalDialog` (`<Teleport to="body">`), `Wizard`,
  `FramedPanel`, and a `ConformanceApp` driven by `?view=` and the pathname, as in
  `App.tsx`.
- Props are passed explicitly. Turn `inheritAttrs` off where fallthrough would add
  attributes the React fixture doesn't render.
- `serve:fixture` serves the build with an SPA fallback, like
  `ember-vite/scripts/serve-fixture.mjs`.

**Runs:**

| Runner              | Wiring                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| parity              | `parityTest` under Vitest + jsdom, rendering through `@testing-library/vue`                                                  |
| dom                 | the catalog and page specs under Vitest + jsdom, with `@testing-library/vue`'s `render` and the `dom` driver                 |
| Vitest browser mode | the catalog with the `vitest-browser` driver, mounted through `vitest-browser-vue`                                           |
| Playwright          | a `vue` project in `playwright-frameworks` against `serve:fixture`, running `specs`, `pageSpecs`, and `urlSpecs`             |
| Cypress CT          | `test-apps/cypress-ct-frameworks` with a `vue` spec folder, mounting through `cypress/vue` and running the component catalog |

`cypress-ct-frameworks` is created here and gains a folder per framework. It is a
Cypress project with one `component.devServer` per framework, chosen by
`CYPRESS_FRAMEWORK` so each framework is its own CI matrix entry.

**README.**

- The UI-frameworks table gets a Vue row (✓), and "Vue, Svelte, Angular, Solid · coming soon" shrinks.
- A short "Using with Vue" note: nothing changes for the harness; here's
  `@testing-library/vue` plus the Vite plugin order.

### Phase 3: Solid

Same shape as Vue (`vite-plugin-solid`, `@solidjs/testing-library`,
`vitest-browser-solid` or a hand-written mount if that package lags).

- **Portal.** Solid's `<Portal>` mounts into a wrapper `<div>` under `body`. The parity
  tree covers only the stage, so it is unaffected. The dialog specs reach the dialog
  by role, so the wrapper doesn't matter to them either. Document the wrapper in the
  README note, so nobody writes a `global` selector that assumes `body > [role=dialog]`.
- **Cypress CT:** none (decision 16). The matrix cell is — with a footnote.

### Phase 4: Svelte 5

Same shape (`@sveltejs/vite-plugin-svelte`, `@testing-library/svelte`,
`vitest-browser-svelte`, `@cypress/svelte` for CT).

- **Portal.** Svelte has no Teleport. `PortalDialog` mounts its dialog with `mount()`
  into `document.body` from an `$effect`, and unmounts in its teardown. Parity and
  guarantee 5 show whether the markup matches.
- **Plugin order.** `harnessedDecorators()` must not touch `.svelte` files. Its
  default `include` is `.ts`/`.tsx`, so it doesn't, but add a check for it.

### Phase 5: Nightwatch

New package `@harnessed-ts/nightwatch`, built on Phase 0.4's `resolve/webdriver`.

**Env.** `nightwatch(browser)` → `{ driver: 'nightwatch', browser }`. Nightwatch
commands are awaitable, so harnesses are used directly with `await`. No bridge is needed.

**Query.**

- Resolution: the injected resolver through `browser.execute`, returning element refs,
  with `testIdAttribute` passed on every call.
- Actions: `browser.driver` (selenium-webdriver) `WebElement.click`, `sendKeys`,
  `clear`. Hover and press go through the Actions API.
- `selectOption` and `upload` (guarantee 13) go through `sendKeys` on the file input.
- Strictness is checked before every action (2). `count()` does not wait (1).

**Navigation.** `browser.navigateTo`, `browser.getCurrentUrl`, and `waitForUrl` polling
the latter. **Frames:** `browser.frame(el)` / `frameParent()` through
`resolve/webdriver`'s realm code. Cross-origin works.

**Runs:**

| Runner                 | Wiring                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| e2e, Nightwatch runner | `test-apps/nightwatch`, against the served React fixture. Chrome and Firefox                                                                                                                             |
| e2e, Mocha runner      | the same specs through Nightwatch's Mocha test runner, so the Chai path is proven under both                                                                                                             |
| component testing      | `@nightwatch/react` and `@nightwatch/vue` (the Vue port from Phase 2): `mountComponent`, then the component catalog. Chrome only                                                                         |
| Gherkin                | `@harnessed-ts/gherkin/nightwatch`: a `Before` that builds the env from Nightwatch's `browser` for the existing `HarnessedWorld`, run under Nightwatch's Cucumber runner against the shared feature file |

**Assertions.** `@harnessed-ts/chai` (decision 27). No custom Nightwatch assertions.

**README.** "Using with Nightwatch", with e2e, component testing, and Gherkin
subsections, a matrix row, and a Gherkin column entry.
**Site.** The Nightwatch hero box goes solid. Runner table row; use cases' Gherkin
list gains Nightwatch.

### Phase 6: Angular

Angular is last because it is the only framework that needs a new driver and the only
one with a decorator conflict.

**Build.** `test-apps/angular` on `@analogjs/vite-plugin-angular`, zoneless,
standalone components, the latest LTS. The app's `tsconfig` keeps
`experimentalDecorators` for `@Component`. Harness and page files are lowered by
`harnessedDecorators({ include: /\.(harness|page)\.ts$/ })` **before** the Angular
plugin, and type-checked through a second `tsconfig.harness.json` without
`experimentalDecorators`. This is the same boundary as risk 1 in the multi-runner plan
for Ember. A fixture proves it in both directions: a harness importing an app module,
and an app component next to a harness.

**Driver** (`@harnessed-ts/angular`, mirroring `@harnessed-ts/ember`):

- `angular({ fixture?, root? })`. With a `ComponentFixture`, each action ends at
  `fixture.whenStable()`. Without one (an app bootstrapped in a browser), it ends at
  `ApplicationRef.whenStable()`, found through the root injector.
- Resolution goes through `@harnessed-ts/resolve`. Interactions go through
  `@testing-library/user-event`, as in `dom`, then `whenStable()`.
- `{ global: true }` starts at `document.body` for CDK overlays.
- Navigation: `registerNavigation('angular', …)` over `Router.navigateByUrl` and
  `Location.path()`, available when the router is provided, refused with the standard
  message otherwise.

**Port.** `PortalDialog` appends its host to `document.body` with a
`DomPortalOutlet` (or a plain `appendChild` if CDK is too heavy for the fixture).

**Runs.**

- parity and the catalog under Vitest + jsdom with `@testing-library/angular` and the
  `angular` driver
- Vitest browser mode
- Playwright (`angular` project)
- Cypress CT through `cypress/angular`

All of these use the `angular` driver where the test is in-process. Playwright and
Cypress keep their own drivers.

**README.**

- "Using with Angular": the two-tsconfig setup, Vite plugin order, and the driver
- the CDK comparison note (decision 14): CDK harnesses are Angular-only and
  component-library-oriented; harnessed is cross-runner and cross-framework
- a matrix row, the UI-frameworks row, and the "coming soon" line removed

**Site.** The Angular hero box goes solid. With it, all four framework boxes are solid.

### Phase 7: Lint and `claude` (land with each library, listed here once)

**`no-raw-locator-in-test` / `no-page-or-screen-in-harness` patterns.** As before, each
applies only when its import source or global is present.

| Library              | Patterns                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Nightwatch           | `browser.element(`, `browser.element.find*`, `browser.findElement(s)`, `browser.click('<selector>')`, `$`/`$$`          |
| Vue / Svelte / Solid | the Testing Library `screen.*` and `getBy*` rules already cover them. Add `wrapper.find` from `@vue/test-utils`         |
| Angular              | `fixture.debugElement.query(`, `fixture.nativeElement.querySelector*`, `By.css(`                                        |
| Bun / node:test      | covered by the existing `document.querySelector*` rules. Tests prove they fire under `bun:test` and `node:test` imports |

**`claude` detection.**

- `nightwatch.conf.*` → Nightwatch
- `bunfig.toml` or `bun.lock` → Bun
- a `node --test` test script → node:test
- `vue`, `svelte`, `solid-js`, or `@angular/core` in dependencies → that framework's
  layout and harness templates

### Phase 8: README and site consolidation

- **Support matrix:** new rows (Angular driver, Nightwatch, Bun test, node:test) and a
  "UI frameworks" column, or the existing UI-frameworks table, showing which runners
  cover which port.
- **Install:** `nightwatch` and `angular` added to the list.
- **Required setup:** the Node and Bun loaders sit beside the Vite plugin and the Babel
  preset.
- **Documented differences:**
  - Solid's portal wrapper
  - Bun on happy-dom (whatever Phase 1 found)
  - `mock.timers` under node:test
- **Packages table:** `angular`, `nightwatch`, and the new subpaths (`core/register`,
  `core/bun`, `dom/matchers/bun`, `resolve/webdriver`, `gherkin/nightwatch`).
- **Site:** a last pass over `docs/site/` for consistency, using the
  [Marketing site](#marketing-site) checklist. By now each phase has already made its
  own edits.

### Phase 9: Coordinated release (0.7.0)

As 0.4.0 did: merge `next` into `main`, which produces one Version Packages PR at
0.7.0 (one `fixed` changeset group). `@harnessed-ts/angular` and
`@harnessed-ts/nightwatch` are **new names**, so before merging the version PR:

- dispatch `bootstrap-publish.yml` on `changeset-release/main`, with the token in the
  `npm-bootstrap` environment
- push `v0.7.0` by hand
- configure trusted publishers for both, then revoke the token

Bump `examples/vitest-dom` afterwards.

## Marketing site

`docs/site/index.html` is hand-written, so nothing updates it for us (CLAUDE.md,
**The website** in CONTRIBUTING.md). Until a phase lands, the site keeps showing that
library as "not yet". The site never claims support ahead of the code. Each phase
makes its own site edits **in the same PR**, and step 0.7's site-sync check fails the
build if a badge or hero box is out of step with the workflows.

### Edits common to every phase

1. **Hero illustration** (`<svg class="hero-art">`). For the library's box:
   - drop `class="todo"` from its `<rect>` and `<text>` under `.nodes` / `.labels`
   - drop `class="todo"` from its rope under `.ropes`
   - add a `<use href="#rope-N" style="--i: K" />` under `.pulses`, with `K` the next
     index, so the line animates like the supported ones
2. **Supported runners table** (`#runners`). One `<tr>` per runner, in matrix order:
   - runner name linking to its `#setup-*` details
   - package
   - environment
   - its `conformance-*.yml` badge or badges
3. **Setup `<details>`** (`#setup-<name>`). A short snippet taken from that package's
   README, highlighted by Prism (`language-typescript`, or `language-bash` for
   install lines).
4. **Preview.** Use the command in CONTRIBUTING.md, checking light mode, dark mode,
   and a 375 px width with no horizontal scroll. The table scrolls inside
   `.overflow-auto`.

### Per phase

| Phase            | Hero (rope)                                | Runner table and setup                                                                                                                                                                                 | Elsewhere on the page                                                                                                                                                                    |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Foundations    | none                                       | none                                                                                                                                                                                                   | none. Step 0.7 adds the site-sync check                                                                                                                                                  |
| 1 node:test, Bun | node:test (`rope-10`), Bun test (`rope-9`) | rows "node:test" (`dom`, jsdom) and "Bun test" (`dom`, happy-dom), badges `conformance-node-test`, `conformance-bun-test`. `#setup-node-test` (the `--import` line), `#setup-bun-test` (`bunfig.toml`) | `#features` "Every runner": add Bun and node:test. Tooling: mention the `core/register` and `core/bun` loaders                                                                           |
| 2 Vue            | Vue (`rope-2`)                             | no new runner row. The Testing Library, Playwright, Vitest browser, and Cypress rows each gain a `conformance-vue` / `-playwright-frameworks` / `-cypress-ct-frameworks` badge                         | `#features` "Framework-agnostic": "Harnesses query the DOM, not React, Ember or Vue", and so on per framework. `#runners` intro: a line saying which frameworks the catalog runs against |
| 3 Solid          | Solid (`rope-5`)                           | `conformance-solid` badge on the Testing Library and Vitest browser rows                                                                                                                               | "Framework-agnostic" copy                                                                                                                                                                |
| 4 Svelte         | Svelte (`rope-3`)                          | `conformance-svelte` badge on the Testing Library and Vitest browser rows                                                                                                                              | "Framework-agnostic" copy                                                                                                                                                                |
| 5 Nightwatch     | Nightwatch (`rope-16`)                     | row "Nightwatch" (`nightwatch`, real browser), badges `conformance-nightwatch`, `-nightwatch-ct`. `#setup-nightwatch` with e2e and component snippets                                                  | `#features` "Every runner" copy. `#use-cases` "BDD with Gherkin": add Nightwatch to the runner list, with a `conformance-gherkin-nightwatch` mention                                     |
| 6 Angular        | Angular (`rope-4`)                         | row "Angular" (`angular`, jsdom or browser), badge `conformance-angular`. `#setup-angular` (two tsconfigs, plugin order, `angular()` env)                                                              | "Framework-agnostic" copy now names all six. Tooling list: `@harnessed-ts/angular`                                                                                                       |
| 8 Consolidation  | Detox is the only dashed box left          | row order matches the README matrix                                                                                                                                                                    | The hero's `<title>` and legend still say dashed means "not yet", which stays true for Detox. `og-image.*` shows no library names, so it needs no change                                 |
| 9 Release        | none                                       | none                                                                                                                                                                                                   | Bump `examples/vitest-dom` to 0.7.0 after publish, so the "Try it live" StackBlitz embed shows the released API                                                                          |

## CI shape

All required on every PR (decision 30), each a `conformance-<name>.yml` over
`conformance-driver.yml`:

| Job                                 | Matrix                                         |
| ----------------------------------- | ---------------------------------------------- |
| `conformance-node-test`             | 1                                              |
| `conformance-bun-test`              | Bun pinned, Bun 1.2                            |
| `conformance-vue`                   | dom + parity, Vitest browser (2)               |
| `conformance-solid`                 | dom + parity, Vitest browser (2)               |
| `conformance-svelte`                | dom + parity, Vitest browser (2)               |
| `conformance-angular`               | dom + parity, Vitest browser (2)               |
| `conformance-playwright-frameworks` | vue, solid, svelte, angular (4)                |
| `conformance-cypress-ct-frameworks` | vue, svelte, angular (3)                       |
| `conformance-nightwatch`            | chrome, firefox × Nightwatch runner, Mocha (4) |
| `conformance-nightwatch-ct`         | react, vue (2)                                 |
| `conformance-gherkin-nightwatch`    | 1                                              |
| `conformance-webdriverio`           | unchanged, re-proven by step 0.4               |

That adds 25 matrix entries. Every job downloads the shared build artifact and
uses cached browsers. If wall-clock time becomes a problem, the fallback is the same as
before: move the heaviest to nightly. That reverses decision 30, so it needs your
sign-off.

## Risks and open questions

1. **happy-dom under Bun.** It is the first non-jsdom simulated DOM. With no
   opt-outs, a real gap stalls Phase 1 until it is fixed or Bun moves to jsdom.
   Spike the catalog on happy-dom on day one.
2. **Bun and `accessor`.** If Bun's transpiler mis-lowers rather than rejects
   `accessor`, failures will be subtle. Step 0.3's test checks behaviour (a
   decorated field has its getter), not just that it loads.
3. **Angular decorator boundary.** A harness importing an Angular component file
   pulls in `experimentalDecorators` code. The `include` regex is the boundary, and
   the Phase 6 fixture proves both directions.
4. **Analog plugin and Angular versions.** Analog trails Angular majors. If it lags
   the LTS floor, fall back to the Angular CLI's esbuild builder for the served app,
   keeping Analog only for Vitest.
5. **Nightwatch CT maturity.** `@nightwatch/vue` and `@nightwatch/react` are less
   used than Cypress CT. If either can't host the component catalog, that subsection
   ships with one framework and the other becomes a follow-up. Raise it at the
   Phase 5 checkpoint.
6. **Fixture drift ×4.** Four more ports means four more places for markup to drift.
   `parityTest` (0.5) makes each port's guard one line, and the React pin is still
   the single source.
7. **CI cost.** 25 new required entries on top of about 25 today.
8. **0.7.0 timeline** depends on Angular, the slowest phase. Decide at the Phase 5
   checkpoint whether to hold the release for it.

## Follow-up: Detox

Out of scope (decision 1), recorded so the dashed hero box has a plan behind it:

- **No DOM.** `@harnessed-ts/resolve` sits on `@testing-library/dom`, so Detox needs
  a native resolver. Selectors map partly: `testId` → `by.id`, `label` → `by.label`,
  `text` → `by.text`, a scope chain → `withAncestor`. `role`/`level`,
  `placeholder`, frames, portals, `data-test-*`, and `upload` don't map.
- **Capability tags** (deferred, decision 29) are the prerequisite. Specs declare
  `requires: ['dom', 'frames', …]`, and a driver without a capability must refuse
  with a standard, tested error.
- **A React Native fixture port**, and probably a React Native Testing Library
  driver alongside it, so the same harness runs at unit and e2e level, the way `dom`
  and `playwright` pair today.
- **Mobile CI:** an Android emulator on Linux runners (KVM) or iOS on macOS.

## Suggested PR sequence (all targeting `next`)

1. `chore`: create `next`, point CI at it (0.1)
2. `feat(core)`: `/register` and `/bun` decorator loaders (0.2, 0.3)
3. `refactor`: extract `@harnessed-ts/resolve/webdriver` from webdriverio (0.4)
4. `refactor(conformance)`: `parityTest` helper, Ember parity on it (0.5); `test`: `playwright-frameworks` skeleton (0.6); `test`: site-sync check (0.7)
5. `test`: node:test conformance runner (Phase 1)
6. `feat(dom)`: `/matchers/bun`, plus the Bun conformance runner (Phase 1)
7. `test(vue)`: Vue port, parity, dom, Vitest browser, Playwright, Cypress CT (Phase 2)
8. `test(solid)`: Solid port and runs (Phase 3)
9. `test(svelte)`: Svelte port and runs (Phase 4)
10. `feat(nightwatch)`: driver, e2e under both runners (Phase 5)
11. `test(nightwatch)`: component testing; `feat(gherkin)`: `/nightwatch` (Phase 5)
12. `feat(angular)`: driver, port, and runs (Phase 6)
13. `docs`: README and site consolidation (Phase 8)
14. `chore(release)`: 0.7.0 (Phase 9)

Lint patterns and `claude` detection ride in the PR of the library they cover (Phase 7).
