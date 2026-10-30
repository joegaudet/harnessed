# @harnessed-ts/eslint-plugin

## 0.7.0

### Minor Changes

- ec06bdf: Vue, Solid, Svelte and Angular join React and Ember as conformance-tested UI frameworks, and node:test, Bun and Nightwatch join the runners.

  New packages: `@harnessed-ts/nightwatch` drives Nightwatch 3 through the injected resolver, under Nightwatch's own runner and its Mocha runner, in end-to-end and component tests (`@nightwatch/react`, `@nightwatch/vue`), with cross-origin frames. `@harnessed-ts/angular` drives zoneless Angular 21+: every action settles at `fixture.whenStable()`, or at the `ApplicationRef`'s for an app bootstrapped without TestBed, and `goto()` drives a provided router.

  `@harnessed-ts/core/register` loads TypeScript harnesses under `node --import`: esbuild strips the types, lowers standard decorators and `accessor`, and compiles JSX. `@harnessed-ts/core/bun` does the same as a `bun test` preload, so harnesses keep the standard decorator protocol whatever `experimentalDecorators` the tsconfig sets.

  `@harnessed-ts/dom/matchers/bun` registers the matchers with `bun:test`. The dom driver runs on happy-dom too: it focuses the frames leading to an interaction's target, finds a frame's `<iframe>` where `frameElement` is unset, and reads a select's selection off `options`.

  `@harnessed-ts/resolve/webdriver` holds the WebDriver half of injected resolution, shared by the WebdriverIO and Nightwatch drivers. `@harnessed-ts/gherkin/nightwatch` adapts the cucumber-js world to Nightwatch's Cucumber runner.

  `@harnessed-ts/playwright`, and `@harnessed-ts/cypress` under `realEvents`, give the page a task after every action, so a read straight after it sees what a framework that renders on a timer (zoneless Angular) has rendered. The injectable resolver installs on the page's `window` rather than the script's global, which under Firefox's WebDriver is a sandbox in front of it.

  `@harnessed-ts/conformance` exports `fixtureParity()`, the per-view parity check a port of the fixture to another framework runs, naming the first place its markup parts from the React original; it detects a simulated DOM from the DOM's own window.

  `@harnessed-ts/eslint-plugin` recognises Nightwatch's, Angular's and Vue Test Utils' raw queries, and looks in `nightwatch/` by default. `npx @harnessed-ts/claude install` detects Angular, Nightwatch, node:test and Bun.

- 3f53eb6: Ember stories. `@harnessed-ts/storybook/ember` renders stories as Ember components under `@storybook/html-vite`, through Ember's public `renderComponent` (Ember 6.8 or later, Storybook 10): spread `emberRenderer` and its `harnessed()` into `.storybook/preview.ts`, and a story renders its meta's `component` with the story's args, or whatever its `render` returns, `<template>` included. Its `harnessed()` resolves every harness interaction once Ember has settled (rendering, run loop, timers and `@ember/test-waiters`), as `@harnessed-ts/ember` does; `settled()` is exported too. `parameters.ember.owner` sets the owner a story renders with. `composeStories`, `composeStory` and `setProjectAnnotations` from the same entry run Ember stories as portable stories, and `Meta`, `StoryObj` and `Preview` type them. `emberIndexer` from `@harnessed-ts/storybook/ember/node` indexes `.stories.gjs` and `.stories.gts` files, whose `<template>` tags Storybook's own indexer cannot parse; it needs `content-tag`. The conformance catalog runs against Ember stories all three ways React's do: as portable stories, through `StoryPage` under Playwright, and through the Vitest addon.

  `storiesModule()` from `@harnessed-ts/storybook/page` stands in for a stories module a Node runner cannot import (one that imports Ember components), typed as that module: `StoryPage.goto` only reads its meta's `title` or `id`.

  `harnessed()` takes an `afterAction` option, awaited after every interaction a harness makes, and `dom()` takes the same option for any framework that renders asynchronously.

  The ESLint plugin treats `.stories.gjs` and `.stories.gts` files as stories files, so `no-raw-locator-in-test` flags raw canvas queries in Ember play functions.

### Patch Changes

- @harnessed-ts/config@0.7.0

## 0.6.0

### Minor Changes

- e324e94: ember-test-selectors style test ids: `configure({ testIdAttribute: 'data-test-*' })` makes `testId('x')` match any element that has the attribute `data-test-x`, whatever its value, with the same scoping, strictness, `{ global: true }`, frame and absence rules as before under every driver. A plain attribute name keeps matching by value. A presence id is held to letters, digits, `-`, `_`, `.` and `:`, and anything else (or a `RegExp`) is refused rather than spliced into a selector.

  `Query.boundingBox()` resolves to `{ x, y, width, height }`: the target's border box in CSS pixels, relative to the top-level viewport, offset by every frame crossed. Strict, and on an absent target it rejects after the timeout, as `text()` does. A node that draws no box reads as all zeros, and so does every node under the dom driver: jsdom computes no layout.

  `Query.upload(files)` sets the files of an `<input type="file">`, or of the input a `<label>` is for, and fires `input` and `change`, replacing any earlier selection. It refuses any other element, and several files for an input that is not `multiple`. Puppeteer, WebdriverIO and TestCafe take only paths, so there each `File` is written to a temporary directory first: its name and bytes arrive, and the browser infers its type from the extension.

  `Query` gains two abstract members, so a driver outside this repo implements both to keep compiling; the conformance catalog pins all three changes.

  `@harnessed-ts/eslint-plugin` supports ESLint 8.57 and legacy `.eslintrc`: the peer range is now `>=8.57`, `legacy-recommended` and `legacy-strict` name the rules under `@harnessed-ts/`, and the CJS build exposes `rules` and `configs` at the top level, where eslintrc reads them.

  `npx @harnessed-ts/claude install` detects ember-test-selectors attributes (in `.gts`, `.gjs` and `.hbs` files too) and writes `testIdAttribute: 'data-test-*'`.

  `@harnessed-ts/storybook` writes and finds its story-ready marker under a `data-test-*` config, where `StoryPage` waits for it.

### Patch Changes

- @harnessed-ts/config@0.6.0

## 0.5.0

### Minor Changes

- ad20e8c: Add `@harnessed-ts/storybook`. Spread `harnessed()` into `.storybook/preview.ts`, and a story that names its harness in `parameters.harness` gets it in `play` as `context.harness`. The harness drives the canvas through Storybook's instrumented `userEvent`, each public method is a step in the Interactions panel (secret-looking arguments are masked by parameter name in development, and by object key in a minified build too), and the harness matchers are registered on `storybook/test`'s `expect`. `StoryPage` from `@harnessed-ts/storybook/page` opens a story by URL from any runner that can navigate, with typed `args` and `globals`, `play: false` to skip the play function, and a play function's own error when it throws. React only: `@storybook/ember` builds with webpack, and Storybook's Vitest addon needs Vite.

  `no-raw-locator-in-test` now treats `*.stories.*` files as tests, flagging `canvas.getBy*`, `within` from `storybook/test`, and `canvasElement.querySelector`. `npx @harnessed-ts/claude install` detects Storybook and documents the preview setup, `play` with a harness, and `StoryPage`.

### Patch Changes

- @harnessed-ts/config@0.5.0

## 0.4.0

### Minor Changes

- 9666a3d: `no-raw-locator-in-test` and `no-page-or-screen-in-harness` now recognise every supported runner's raw queries: Cypress (`cy.get` — but not `cy.get('@alias')` — `cy.contains`, `cy.findBy*`), Ember (`find`/`findAll`, test-helpers actions given a selector string, `this.element.querySelector`, `assert.dom('…')`), WebdriverIO (`$`/`$$`, imported or the testrunner's globals, `browser.$`), Puppeteer (`page.$`, `page.$$eval`, `page.waitForSelector`), Vitest browser (`page.getBy*` from `vitest/browser`) and TestCafe (`Selector`). Testing Library's `getAllBy*`, `queryAllBy*`, `findAllBy*` and the rest of the `*By*` family are caught too. Bare function names (`find`, `$`, `Selector`) are matched by import source, and resolved through scope, so lodash's `find`, jQuery's `$` or a local `$` are left alone. The harness rule now flags a bare `page`'s queries as well as `this.page`. The default test directories add `test/` and `cypress/` (Cypress's `support/` files excepted), and a harness under a test directory, such as Ember's `tests/harness/`, is left to the harness rule.
- 3bfda4b: Harnesses speak in behaviours, never in the vocabulary of a test runner or the DOM.

  **eslint-plugin.** Three new rules, all in `recommended` and `strict`:

  - `no-runner-import-in-harness` (error): a harness may not import a runner or a driver — `@playwright/test`, `cypress`, `@testing-library/*`, `vitest`, `webdriverio`, `puppeteer`, `testcafe`, `@ember/test-helpers`, `qunit`, `ember-qunit`, `qunit-dom`, `chai`, the Gherkin runners (`playwright-bdd`, `@cucumber/*`, Cypress cucumber, Yadda), and every `@harnessed-ts` package except `core`, `page`, and `route` — nor use the `document`, `window`, `cy`, `browser`, `$`, or `$$` globals (directly or through `globalThis`) outside a page's `waitForReady()`. `allow` takes exceptions.
  - `harness-public-surface` (error): element fields (`@ByRole`, `@ByTestId`, `@ByLabel`, `@ByText`, `@ByPlaceholder`) must be private or protected; a public method may not return a `Query`, locator, element, or selector, nor take one in. A `@ChildHarness` may stay public.
  - `behavioural-method-names` (warn): public harness methods named for a mechanic (`clickSubmit`) or a DOM noun (`submitButton`). Configurable with `verbs`, `nouns`, and `allow`.

  `no-raw-locator-in-test` now also catches any member of Testing Library's `screen` (`screen.debug()` reads markup too) and `fireEvent`, its `within(…)`, the global `document`'s own queries (`querySelector`, `getElementById` and friends), and `cy.xpath`. Like the runner queries it already knew, these are resolved through scope and matched by import source: a local binding named `screen`, `within`, `fireEvent` or `document`, or a `screen` imported from anywhere but `@testing-library/*`, is left alone — though a locator method such as `getByRole` is still caught on any `screen`. `cy.xpath` is a Cypress query to `no-page-or-screen-in-harness` too.

  These can fail a build that passed before: the two new errors are on by default in `recommended`.

  **claude.** The harness rule and skill gain a "Speak in behaviours" section with the portability test, and `install` writes a new `.claude/rules/harness-tests.md`, path-scoped to test files.

### Patch Changes

- Updated dependencies [9666a3d]
  - @harnessed-ts/config@0.4.0

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

Five rules that make the harness authoring conventions a gate rather than a
convention: no `page`/`screen` inside a harness, a required `@Harness({ host })`, a
non-empty `waitForReady()`, no casting through `unknown` to reach protected
members, and no raw locators in tests. Reads `harnessed.config.ts` for the harness
directory when one is present.
