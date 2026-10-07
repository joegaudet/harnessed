# @harnessed-ts/claude

## 0.4.0

### Minor Changes

- 9666a3d: `install` detects the repo's test runners — Ember, Cypress, WebdriverIO, TestCafe, Puppeteer, Playwright, Vitest browser mode, Testing Library, and the Gherkin runners — from the dependencies (including peer and optional ones) and config files of the root and each workspace package, from `workspaces` or `pnpm-workspace.yaml`. The skill gains a generated "Your runners" section showing how a test in that repo builds the env and asserts, and a worked example is written per detected runner, with the Gherkin one matching the adapter in use. `--runners a,b` chooses the runners instead, and a re-run removes the examples of runners no longer in use.
- 3bfda4b: Harnesses speak in behaviours, never in the vocabulary of a test runner or the DOM.

  **eslint-plugin.** Three new rules, all in `recommended` and `strict`:

  - `no-runner-import-in-harness` (error): a harness may not import a runner or a driver — `@playwright/test`, `cypress`, `@testing-library/*`, `vitest`, `webdriverio`, `puppeteer`, `testcafe`, `@ember/test-helpers`, `qunit`, `ember-qunit`, `qunit-dom`, `chai`, the Gherkin runners (`playwright-bdd`, `@cucumber/*`, Cypress cucumber, Yadda), and every `@harnessed-ts` package except `core`, `page`, and `route` — nor use the `document`, `window`, `cy`, `browser`, `$`, or `$$` globals (directly or through `globalThis`) outside a page's `waitForReady()`. `allow` takes exceptions.
  - `harness-public-surface` (error): element fields (`@ByRole`, `@ByTestId`, `@ByLabel`, `@ByText`, `@ByPlaceholder`) must be private or protected; a public method may not return a `Query`, locator, element, or selector, nor take one in. A `@ChildHarness` may stay public.
  - `behavioural-method-names` (warn): public harness methods named for a mechanic (`clickSubmit`) or a DOM noun (`submitButton`). Configurable with `verbs`, `nouns`, and `allow`.

  `no-raw-locator-in-test` now also catches any member of Testing Library's `screen` (`screen.debug()` reads markup too) and `fireEvent`, its `within(…)`, the global `document`'s own queries (`querySelector`, `getElementById` and friends), and `cy.xpath`. Like the runner queries it already knew, these are resolved through scope and matched by import source: a local binding named `screen`, `within`, `fireEvent` or `document`, or a `screen` imported from anywhere but `@testing-library/*`, is left alone — though a locator method such as `getByRole` is still caught on any `screen`. `cy.xpath` is a Cypress query to `no-page-or-screen-in-harness` too.

  These can fail a build that passed before: the two new errors are on by default in `recommended`.

  **claude.** The harness rule and skill gain a "Speak in behaviours" section with the portability test, and `install` writes a new `.claude/rules/harness-tests.md`, path-scoped to test files.

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

### Patch Changes

- 9666a3d: `loadConfigFor` no longer walks to the filesystem root: it stops at the project root — the nearest git checkout or workspace root (`.git`, `pnpm-workspace.yaml`, or a `package.json` with `workspaces`), else the nearest `package.json` — so a `harnessed.config.ts` above the project is never executed. A config at a monorepo's root still governs its nested packages. `npx @harnessed-ts/claude install` now escapes the values it writes into `harnessed.config.ts`, so a path containing a quote or backslash no longer produces a broken file.
- Updated dependencies [9666a3d]
  - @harnessed-ts/config@0.4.0

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

### Patch Changes

- Updated dependencies [66deb00]
  - @harnessed-ts/config@0.3.0

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

### Patch Changes

- Updated dependencies
  - @harnessed-ts/config@0.2.0

## 0.1.0

First release.

Installs the harness authoring skill, rules, and templates into a repo's `.claude/`
directory, generating the file-placement table from that repo's actual layout. An
existing `harnessed.config.ts` wins over detection, so re-running cannot produce
docs that contradict the config beside them.
