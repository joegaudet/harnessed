# @harnessed-ts/core

## 0.4.0

### Minor Changes

- 9666a3d: Two new assertion packages, both backed by core's one matcher implementation so the messages read the same under every runner:

  - `@harnessed-ts/qunit`: `install(QUnit)` adds `assert.harness(x)` with `isAbsent`/`isPresent`, `isSelected`/`isNotSelected`, and `readsAs`/`doesNotReadAs`, reported through `pushResult`. For ember-qunit and any QUnit suite.
  - `@harnessed-ts/chai`: `chai.use(harnessedChai)` adds `absent`, `selected`, and `readAs`, awaitable and negatable. For Mocha, ember-mocha, Cypress, and WebdriverIO under Mocha.

  `harnessMatchers` results now carry `observed: { actual, expected }`, which the QUnit and Chai adapters report so their runners can show what was read.

- 9666a3d: Add `@harnessed-ts/core/babel`, a Babel plugin for apps whose own decorators are legacy — Ember's `@tracked`, `@service`, `@action`. It claims harness files only (`*.harness.*`, `*.page.*`, `harness/`, `harnesses/`, or your own `include`), lowers their standard decorators and `accessor` fields before the app's plugins run, and leaves every other file to the app's pipeline. Tested through both ember-cli-babel's legacy proposal plugin and Embroider's decorator-transforms.
- 1823546: `isVisible()`, `waitFor('visible')` and `waitFor('hidden')` on a target matching
  several nodes now reject with the shared strict-mode violation, at once, under
  every driver. The dom, Ember, Vitest browser mode and Cypress drivers answered
  `false` from `isVisible()`, waited out the timeout in `waitFor('visible')`, and —
  worse — resolved `waitFor('hidden')` at once, passing a wait for three rendered
  nodes to disappear; Playwright's waits raised its own wording instead of the
  shared one. An `nth()`
  past the last match answers `false` from `isVisible()` and counts as hidden, as it
  does under Playwright — Puppeteer and TestCafe used to reject it as an index out
  of range.

  Core exports `StrictModeViolation`, the class `strictViolation()` now returns, so a
  driver can tell ambiguity apart from absence. It is the class a caller catches
  under every driver: core also exports `reviveStrictViolation()`, which the
  Puppeteer, WebdriverIO and TestCafe drivers apply to what the page throws, so
  a violation raised in the page arrives as core's class, worded exactly as an
  in-process driver words it. `instanceof StrictModeViolation` checks a brand
  rather than the prototype, so it holds across two copies of core in one page —
  Cypress bundles the support file and each spec separately.

  `WaitState` now documents the rule it is held to: a state joins only when every
  driver honours it with the same meaning, so a runner's own states — Playwright's
  `attached` and `detached` — stay out of the shared interface.

## 0.3.0

### Minor Changes

- b2d1130: Harnesses can reach into iframes. `frame(selector)` marks an `<iframe>` in a
  scope chain, and everything scoped under it resolves inside the frame's
  document:

  - `@ChildHarness(Cls, { frame: testId('…') })` and `childHarness(Cls, { frame })`
    nest an unchanged harness inside a frame — the harness written for an embedded
    app drives it from the page that embeds it.
  - `@Harness({ host: frame(testId('…')) })` makes the iframe itself the host:
    `self` is the element, fields are inside its document.
  - Inside a frame, `{ global: true }` searches the frame's document, so a framed
    harness still finds its own portals.
  - A page nested in a frame refuses `goto()` and its other URL members, which
    would otherwise act on the page around it.

  Playwright enters cross-origin frames via `Locator.contentFrame()`, so
  `@harnessed-ts/playwright` (and the conformance suite) now need
  `@playwright/test` ≥ 1.43. The dom driver enters same-origin frames and refuses
  a cross-origin or non-iframe target with an error naming it. Conformance adds
  guarantee 10.

- 66deb00: Page objects. `PageHarness` (new package `@harnessed-ts/page`) replaces
  `RouteHarness`: a page is a screen composed of component harnesses and other
  pages, that constructs under every driver, knows when it has arrived
  (`expectReady()` / `isReady()`), optionally owns a URL (`path` + `goto()`), and
  hands back the page an action leads to (`transitionTo()`).

  - `@harnessed-ts/route` is now a deprecated shim re-exporting `PageHarness` as
    `RouteHarness`. It is removed in the next minor. Two source-level changes
    reach existing routes through it: `path` is no longer abstract, so under
    `noImplicitOverride` a `get path()` needs the `override` modifier; and
    `goto()` now wraps a failed `waitForReady()` as `<Page> did not become ready.`
    with the original error as `cause`.
  - `@ChildHarness` and `childHarness()` accept any harness, so pages nest pages.
  - Matchers accept any harness with a host, pages included.
  - **Breaking config rename:** `layout.screens` → `layout.pages`,
    `layout.screenHarnesses` → `layout.pageHarnesses`, `testIdPattern.screen` →
    `testIdPattern.page` (default `page-<kebab>`). An old `harnessed.config.ts`
    is a compile error until updated. The `@harnessed-ts/claude` CLI flags rename
    likewise (`--pages`, `--page-harnesses`, `--page-testid`).
  - New `strict`-only rule `no-component-harness-in-test`: tests enter through a
    page. Runtime-agnostic via `testFiles` globs; a file that renders the component
    itself is exempt.
  - `require-wait-for-ready` now checks `PageHarness` (and the deprecated
    `RouteHarness`).
  - Conformance: `routeSpecs` became `pageSpecs` (every driver) and `urlSpecs`
    (navigating drivers).

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

## 0.1.0

First release.

The driver-free core: `Query`, the `Selector` builders, `ComponentHarness` and the
shared `ScopedHarness`, the `@Harness` / `@ByRole` / `@ChildHarness` decorators, the
driver registry, `configure()` / `applyConfig()`, runner-agnostic matcher
implementations, and the Vite plugin that lowers standard decorators.

Depends on no driver: drivers register themselves against a registry keyed on
`globalThis`, which is also what keeps a dual ESM/CJS install from ending up with
two of everything. Navigation is an optional capability a driver can register, so
`@harnessed-ts/route` works against anything that can drive a URL.
