# @harnessed-ts/storybook

## 0.7.0

### Minor Changes

- 3f53eb6: Ember stories. `@harnessed-ts/storybook/ember` renders stories as Ember components under `@storybook/html-vite`, through Ember's public `renderComponent` (Ember 6.8 or later, Storybook 10): spread `emberRenderer` and its `harnessed()` into `.storybook/preview.ts`, and a story renders its meta's `component` with the story's args, or whatever its `render` returns, `<template>` included. Its `harnessed()` resolves every harness interaction once Ember has settled (rendering, run loop, timers and `@ember/test-waiters`), as `@harnessed-ts/ember` does; `settled()` is exported too. `parameters.ember.owner` sets the owner a story renders with. `composeStories`, `composeStory` and `setProjectAnnotations` from the same entry run Ember stories as portable stories, and `Meta`, `StoryObj` and `Preview` type them. `emberIndexer` from `@harnessed-ts/storybook/ember/node` indexes `.stories.gjs` and `.stories.gts` files, whose `<template>` tags Storybook's own indexer cannot parse; it needs `content-tag`. The conformance catalog runs against Ember stories all three ways React's do: as portable stories, through `StoryPage` under Playwright, and through the Vitest addon.

  `storiesModule()` from `@harnessed-ts/storybook/page` stands in for a stories module a Node runner cannot import (one that imports Ember components), typed as that module: `StoryPage.goto` only reads its meta's `title` or `id`.

  `harnessed()` takes an `afterAction` option, awaited after every interaction a harness makes, and `dom()` takes the same option for any framework that renders asynchronously.

  The ESLint plugin treats `.stories.gjs` and `.stories.gts` files as stories files, so `no-raw-locator-in-test` flags raw canvas queries in Ember play functions.

### Patch Changes

- Updated dependencies [ec06bdf]
- Updated dependencies [3f53eb6]
  - @harnessed-ts/core@0.7.0
  - @harnessed-ts/dom@0.7.0
  - @harnessed-ts/page@0.7.0

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

- Updated dependencies [e324e94]
  - @harnessed-ts/core@0.6.0
  - @harnessed-ts/dom@0.6.0
  - @harnessed-ts/page@0.6.0

## 0.5.0

### Minor Changes

- ad20e8c: Add `@harnessed-ts/storybook`. Spread `harnessed()` into `.storybook/preview.ts`, and a story that names its harness in `parameters.harness` gets it in `play` as `context.harness`. The harness drives the canvas through Storybook's instrumented `userEvent`, each public method is a step in the Interactions panel (secret-looking arguments are masked by parameter name in development, and by object key in a minified build too), and the harness matchers are registered on `storybook/test`'s `expect`. `StoryPage` from `@harnessed-ts/storybook/page` opens a story by URL from any runner that can navigate, with typed `args` and `globals`, `play: false` to skip the play function, and a play function's own error when it throws. React only: `@storybook/ember` builds with webpack, and Storybook's Vitest addon needs Vite.

  `no-raw-locator-in-test` now treats `*.stories.*` files as tests, flagging `canvas.getBy*`, `within` from `storybook/test`, and `canvasElement.querySelector`. `npx @harnessed-ts/claude install` detects Storybook and documents the preview setup, `play` with a harness, and `StoryPage`.

### Patch Changes

- @harnessed-ts/core@0.5.0
  - @harnessed-ts/dom@0.5.0
  - @harnessed-ts/page@0.5.0
