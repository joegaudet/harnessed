---
'@harnessed-ts/core': minor
'@harnessed-ts/resolve': minor
'@harnessed-ts/dom': minor
'@harnessed-ts/playwright': minor
'@harnessed-ts/ember': minor
'@harnessed-ts/vitest-browser': minor
'@harnessed-ts/cypress': minor
'@harnessed-ts/puppeteer': minor
'@harnessed-ts/webdriverio': minor
'@harnessed-ts/testcafe': minor
'@harnessed-ts/conformance': minor
'@harnessed-ts/eslint-plugin': minor
'@harnessed-ts/claude': minor
'@harnessed-ts/storybook': minor
---

ember-test-selectors style test ids: `configure({ testIdAttribute: 'data-test-*' })` makes `testId('x')` match any element that has the attribute `data-test-x`, whatever its value, with the same scoping, strictness, `{ global: true }`, frame and absence rules as before under every driver. A plain attribute name keeps matching by value. A presence id is held to letters, digits, `-`, `_`, `.` and `:`, and anything else (or a `RegExp`) is refused rather than spliced into a selector.

`Query.boundingBox()` resolves to `{ x, y, width, height }`: the target's border box in CSS pixels, relative to the top-level viewport, offset by every frame crossed. Strict, and on an absent target it rejects after the timeout, as `text()` does. A node that draws no box reads as all zeros, and so does every node under the dom driver: jsdom computes no layout.

`Query.upload(files)` sets the files of an `<input type="file">`, or of the input a `<label>` is for, and fires `input` and `change`, replacing any earlier selection. It refuses any other element, and several files for an input that is not `multiple`. Puppeteer, WebdriverIO and TestCafe take only paths, so there each `File` is written to a temporary directory first: its name and bytes arrive, and the browser infers its type from the extension.

`Query` gains two abstract members, so a driver outside this repo implements both to keep compiling; the conformance catalog pins all three changes.

`@harnessed-ts/eslint-plugin` supports ESLint 8.57 and legacy `.eslintrc`: the peer range is now `>=8.57`, `legacy-recommended` and `legacy-strict` name the rules under `@harnessed-ts/`, and the CJS build exposes `rules` and `configs` at the top level, where eslintrc reads them.

`npx @harnessed-ts/claude install` detects ember-test-selectors attributes (in `.gts`, `.gjs` and `.hbs` files too) and writes `testIdAttribute: 'data-test-*'`.

`@harnessed-ts/storybook` writes and finds its story-ready marker under a `data-test-*` config, where `StoryPage` waits for it.
