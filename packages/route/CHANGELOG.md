# @harnessed-ts/route

## 0.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [b2d1130]
- Updated dependencies [66deb00]
  - @harnessed-ts/page@0.3.0

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

### Patch Changes

- Updated dependencies
  - @harnessed-ts/core@0.2.0

## 0.1.0

First release.

`RouteHarness<Params>` — one test object per URL. Path params are declared, so
`goto()` is checked against the path; substitution is URL-encoded and applies at
every occurrence; `waitForReady()` is required and runs after every navigation.

Runs on the driver's navigation capability, so it depends only on
`@harnessed-ts/core` and works against any driver that can drive an address bar.
