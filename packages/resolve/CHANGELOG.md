# @harnessed-ts/resolve

## 0.4.0

### Minor Changes

- 9666a3d: New package `@harnessed-ts/resolve`: the selector resolver the Testing Library driver has always used, extracted so every driver that can run JavaScript in the page shares it — role with `level`, strictness, absence, and frame semantics come from one implementation. Adds non-waiting forms (`resolveOneNow`, `resolveAllNow`) for runtimes that retry on their own, and `@harnessed-ts/resolve/inject`, a self-contained build a remote driver (WebdriverIO, Puppeteer, TestCafe) injects into the page, with `encodeSelector` to carry `RegExp`s across the wire.

  `@harnessed-ts/dom` now depends on it. No behaviour change.

- 9666a3d: Add `isVisibleInLayout(element, home?)`, Playwright's visibility rule — a non-empty box that `visibility` does not hide, inside frames that are visible too — for in-page drivers running in a real browser. The injected page API answers it too, as `visible(element)`, for drivers that resolve from outside the page. The main entry no longer imports Node's `url` and `path` through a chunk shared with `/inject`, so it loads in a browser.
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

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
