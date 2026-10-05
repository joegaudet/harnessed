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
'@harnessed-ts/page': minor
'@harnessed-ts/claude': minor
'@harnessed-ts/conformance': minor
---

**Breaking:** `Query.waitFor(state)` is replaced by `waitForVisible()` and
`waitForHidden()`, and the `WaitState` type is gone. The string state was
Playwright's `locator.waitFor({ state })` showing through the shared interface;
each wait is now a method of its own, and a driver maps it onto its runner.
Migrate `waitFor('visible', opts)` to `waitForVisible(opts)` and
`waitFor('hidden', opts)` to `waitForHidden(opts)`.

`isVisible()`, `waitForVisible()` and `waitForHidden()` on a target matching
several nodes now reject with the shared strict-mode violation, at once, under
every driver. The dom, Ember, Vitest browser mode and Cypress drivers answered
`false` from `isVisible()` and waited out the timeout in a visible wait;
Playwright's waits raised its own wording instead of the shared one. An `nth()`
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
