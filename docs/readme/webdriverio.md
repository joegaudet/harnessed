### Using with WebdriverIO

```bash
npm i -D @harnessed-ts/core @harnessed-ts/webdriverio   # WebdriverIO 10
```

Build the env from the testrunner's `browser` and hand it to any harness or
page. Register the matchers once, from a spec or the config's `before` hook:

```ts
import { wdio } from '@harnessed-ts/webdriverio'
import '@harnessed-ts/webdriverio/matchers' // toBeAbsent, toBeSelected, toReadAs
import { browser, expect } from '@wdio/globals'

it('signs in', async () => {
  const login = new LoginPage(wdio(browser))
  await login.goto() // browser.url(), resolved against baseUrl
  await login.form.fillIn({ email: 'ada@example.com', password: 'hopper' })
  await expect(login.form.errorQuery).toBeAbsent()
})
```

Under Mocha you can assert in Chai's style instead: `chai.use(harnessedChai)`
from `@harnessed-ts/chai`, then `await expect(banner).to.be.absent`.

The shared resolver is injected into each document on first use (under BiDi it
is also registered as a preload script, so later documents start with it), and
`testIdAttribute` travels with every call. Differences from the other drivers:

- **Frames** are entered through WebDriver — a frame's own browsing context under
  BiDi, `switchFrame` under Classic, switched back afterwards — so cross-origin
  frames work. An error raised inside a frame names the scope chain from that
  frame inward.
- **`isVisible()`** is WebDriver's `isDisplayed()`, a layout check, applied to the
  target and to every iframe on the way to it. Like Playwright's, it answers at
  once rather than waiting for the target.
- **`currentUrl`** is the top-level URL as of the driver's last round-trip:
  `goto()`, `assertPathname()`, or any query. After an in-app navigation,
  `await page.assertPathname(...)` before reading it.
- **`fill()` and `clear()`** select the existing value and delete it by keyboard,
  so a controlled input sees the edit. Date, time, colour and range inputs are set
  directly, as WebdriverIO does.
- **`press()`** takes Playwright's key names and `+` chords (`'Shift+Tab'`,
  `'ControlOrMeta+a'`). Bindings are the platform's: `Control+a` does not select
  all on macOS.
- **Waits** run inside the page, so a `timeout` above the session's script
  timeout (30s by default) needs `browser.setTimeout({ script })`.
