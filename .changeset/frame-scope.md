---
'@harnessed-ts/core': minor
'@harnessed-ts/dom': minor
'@harnessed-ts/playwright': minor
'@harnessed-ts/page': minor
'@harnessed-ts/claude': minor
'@harnessed-ts/conformance': minor
---

Harnesses can reach into iframes. `frame(selector)` marks an `<iframe>` in a
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
