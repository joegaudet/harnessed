---
'@harnessed-ts/webdriverio': minor
---

New driver for WebdriverIO 10: `wdio(browser)` runs every harness and page under the WDIO testrunner, over WebDriver BiDi or Classic. Selectors resolve in the page through the shared resolver, frames are entered through WebDriver (cross-origin ones included), and `@harnessed-ts/webdriverio/matchers` registers `toBeAbsent`, `toBeSelected` and `toReadAs` with expect-webdriverio.
