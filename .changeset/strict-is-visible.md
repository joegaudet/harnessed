---
'@harnessed-ts/core': minor
'@harnessed-ts/dom': minor
'@harnessed-ts/playwright': minor
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
every driver. The dom driver answered `false` from `isVisible()` and waited out the
timeout in a visible wait; Playwright's waits raised its own wording instead of the
shared one. An `nth()` past the last match still answers `false`, as it does under
Playwright.

Core exports `StrictModeViolation`, the class `strictViolation()` now returns, so a
driver can tell ambiguity apart from absence.
