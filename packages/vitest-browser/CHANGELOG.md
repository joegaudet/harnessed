# @harnessed-ts/vitest-browser

## 0.7.0

### Patch Changes

- Updated dependencies [ec06bdf]
  - @harnessed-ts/core@0.7.0
  - @harnessed-ts/resolve@0.7.0

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
  - @harnessed-ts/resolve@0.6.0

## 0.5.0

### Patch Changes

- @harnessed-ts/core@0.5.0
  - @harnessed-ts/resolve@0.5.0

## 0.4.0

### Minor Changes

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

- 9666a3d: New package `@harnessed-ts/vitest-browser`: a driver for Vitest browser mode. Harnesses resolve in the page through the shared resolver and act through the provider's `userEvent`, so clicks and typing are real browser input — including inside same-origin frames under the Playwright provider. `@harnessed-ts/vitest-browser/matchers` registers the shared matchers with Vitest's `expect`.

### Patch Changes

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
  - @harnessed-ts/resolve@0.4.0
