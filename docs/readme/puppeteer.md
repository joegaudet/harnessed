### Using with Puppeteer

```bash
npm i -D @harnessed-ts/core @harnessed-ts/puppeteer puppeteer
```

Puppeteer has no test runner, so pick one — Vitest or Jest. Under Vitest, add
`harnessedDecorators()` to the Vitest config (see [Required setup](#required-setup))
and register the matchers from a setup file:

```ts
// vitest.setup.ts
import '@harnessed-ts/puppeteer/matchers'
// Jest: import { harnessMatchers } from '@harnessed-ts/core'; expect.extend(harnessMatchers)
```

Build the env from a Puppeteer `Page`. `baseURL` is what a page's relative `path`
resolves against in `goto()` — Puppeteer, unlike Playwright, has none of its own:

```ts
import { puppeteer } from '@harnessed-ts/puppeteer'
import { launch } from 'puppeteer'

const browser = await launch()
const page = await browser.newPage()
const env = puppeteer(page, { baseURL: 'http://localhost:3000' })

const login = new LoginPage(env)
await login.goto()
await login.form.fillIn({ email: 'ada@example.com' })
await expect(login.form.errorQuery).toBeAbsent()
```

The driver injects `@harnessed-ts/resolve` into each document it queries, so
roles, labels and strictness resolve exactly as they do under the dom driver, and
acts through `ElementHandle`s, so clicks and keys are real browser input.

Differences worth knowing:

- **Frames, cross-origin included.** Each `frame()` link is resolved in the
  document around it and entered with `contentFrame()`, so the driver reaches
  frames that no in-page resolver can.
- **`isVisible()` uses real layout**: a node with no box, `visibility: hidden`, or
  inside a hidden frame reads as hidden. Like the dom driver, it waits for the
  target first; ask `isAbsent()` when you mean "not on screen".
- **`fill()` replaces** the value, as Playwright's does: it selects what is there
  and inserts the new text as one input event, and `fill('')` clears.
- **`press()`** takes Playwright's key names and chords (`Shift+ArrowLeft`).
- **`selectOption()`** matches an option's value, then its label, and replaces a
  multi-select's selection.
