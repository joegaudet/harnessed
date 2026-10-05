---
'@harnessed-ts/resolve': minor
'@harnessed-ts/dom': patch
---

New package `@harnessed-ts/resolve`: the selector resolver the Testing Library driver has always used, extracted so every driver that can run JavaScript in the page shares it — role with `level`, strictness, absence, and frame semantics come from one implementation. Adds non-waiting forms (`resolveOneNow`, `resolveAllNow`) for runtimes that retry on their own, and `@harnessed-ts/resolve/inject`, a self-contained build a remote driver (WebdriverIO, Puppeteer, TestCafe) injects into the page, with `encodeSelector` to carry `RegExp`s across the wire.

`@harnessed-ts/dom` now depends on it. No behaviour change.
