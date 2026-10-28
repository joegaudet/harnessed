# @harnessed-ts/resolve

The selector resolver behind every Testing Library-family driver for
`@harnessed-ts/core`. It turns a scope chain plus a `Selector` into DOM nodes with
the cross-driver guarantees built in: `role` honours `level`, a single-target
lookup is strict, absence answers at once, and only `frame()` crosses into an
`<iframe>`.

You do not install this to write harnesses — a driver depends on it. Install it
when you are **writing a driver**.

## In-process drivers

A driver that shares a realm with the page (jsdom, Ember's test container,
Cypress's AUT, Vitest browser mode) calls the resolver directly:

```ts
import { countAll, resolveOne } from '@harnessed-ts/resolve'

const element = await resolveOne(container, scope, selector, timeout)
const total = await countAll(container, scope, selector)
```

`resolveOneNow`, `resolveAllNow` and `resolveScopeNow` are the non-waiting forms,
for a runtime that does its own retrying: "not there yet" is `null`, while
strictness and frame errors still throw.

A driver running in a real browser answers `isVisible()` with
`isVisibleInLayout(element, home)` — Playwright's rule: a non-empty box that
`visibility` does not hide, inside frames that are visible too, crossed up to
`home`. It answers `boundingBox()` with `boundingBoxOf(element, home)`, which adds
each crossed frame's `frameOrigin()`, and finds an upload's input with
`fileInputOf(element)` — the element, or a `<label>`'s control — before handing
the result to core's `checkFileTarget()`.

A remote driver asks the same of the page through `box`, `origin` and
`fileTarget`, and adds the origin of each frame it entered itself.
`filesOnDisk(files)` from `@harnessed-ts/resolve/inject` writes `File`s to a
temporary directory for a browser that only takes paths.

## Remote drivers

A driver whose test code runs in Node while the page runs elsewhere (WebdriverIO,
Puppeteer, TestCafe) injects a self-contained build and calls it through the page:

```ts
import { encodeSelector, injectSource, PAGE_API_GLOBAL } from '@harnessed-ts/resolve/inject'

await page.evaluate(injectSource())
const handle = await page.evaluateHandle(
  (name, scope, selector, options) => window[name].one(null, scope, selector, options),
  PAGE_API_GLOBAL,
  scope.map(encodeSelector),
  encodeSelector(selector),
  { testIdAttribute: 'data-testid', timeout: 5000 },
)
```

`encodeSelector` is required: a `RegExp` does not survive WebDriver, CDP or
TestCafe serialisation, and the page API decodes the tagged form back. The
runtime config travels with each call because the page cannot see the test
process's `configure()`. `injectPath()` gives the file's path for tools that inject
by path.

An error the page throws comes back as a plain error: WebDriver, CDP and TestCafe
keep its message and, at most, its name. Pass it through `reviveStrictViolation()`
from `@harnessed-ts/core` so a strict-mode violation is `StrictModeViolation`
again, worded exactly as an in-process driver words it — that is how a caller
tells ambiguity apart from absence.

## WebDriver drivers

A WebDriver client (WebdriverIO, selenium-webdriver under Nightwatch) shares more
than injection: the page script that resolves and reads in one round-trip, and
the walk that enters each frame of a scope chain from outside the page.
`@harnessed-ts/resolve/webdriver` holds both, behind a small `WebDriverLike`
adapter — run the page script in a document, inject the resolver, wrap an
element, enter a frame, leave frames:

```ts
import { callPage, classicScript, walk } from '@harnessed-ts/resolve/webdriver'
import type { WebDriverLike, WebDriverSite } from '@harnessed-ts/resolve/webdriver'

const client: WebDriverLike<WebDriverSite, WebElement> = {
  top: () => ({ top: true, origin: { x: 0, y: 0 } }),
  run: (_site, args) => driver.executeScript(classicScript(), ...args),
  inject: async (_site, source) => void (await driver.executeScript(source)),
  element: async (_site, ref) => ref as unknown as WebElement,
  async enterFrame(_site, iframe, origin) {
    await driver.switchTo().frame(iframe)
    return { top: false, origin }
  },
  leaveFrames: () => driver.switchTo().defaultContent(),
}

const text = await walk(client, scope, { waiting: true, timeout }, (site, rest, remaining) =>
  callPage(client, site, 'text', rest, selector, remaining()),
)
```

Errors the page raises come back as values, so a strict violation arrives as
core's `StrictModeViolation` and a frame that cannot be entered as a
`PageError` (`isFrameEntryError`).

Full guide: the [harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
