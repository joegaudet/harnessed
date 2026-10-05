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

Full guide: the [harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
