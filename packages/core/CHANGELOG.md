# @harnessed-ts/core

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
