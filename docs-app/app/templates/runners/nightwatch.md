# Nightwatch

```bash
npm i -D @harnessed-ts/core @harnessed-ts/nightwatch @harnessed-ts/chai chai # Nightwatch 3
```

Build the env from Nightwatch's `browser` and hand it to any harness or page.
Assert with `@harnessed-ts/chai`, on Chai's own `expect`, not the `expect`
global Nightwatch installs for its element assertions. The same spec runs under
Nightwatch's own runner and under its Mocha runner (`test_runner: { type: 'mocha' }`):

```ts
import { harnessedChai } from '@harnessed-ts/chai'
import { nightwatch } from '@harnessed-ts/nightwatch'
import * as chai from 'chai'

chai.use(harnessedChai)

describe('sign in', function () {
  it('signs in', async function () {
    const login = new LoginPage(nightwatch(browser))
    await login.goto() // browser.navigateTo(), resolved against launch_url
    await login.form.signInAs('ada@example.com', 'hunter2')
    await chai.expect(login.form.errorBanner).to.be.absent
  })
})
```

The shared resolver is injected into each document on first use, through
selenium-webdriver's `executeScript` on `browser.driver`, and `testIdAttribute`
travels with every call. Actions are the WebElement's and the Actions API's.
Differences from the other drivers:

- **Frames** are entered with `switchTo().frame()` and left afterwards, so
  cross-origin frames work.
- **`isVisible()`** is the shared layout check made in the page (Playwright's
  rule), not selenium's `isDisplayed()`: `opacity: 0` is visible.
- **`currentUrl`** is the top-level URL as of the driver's last round-trip.
  After an in-app navigation, `await page.assertPathname(...)` before reading it.
- **`goto()`** resolves a relative path against `launch_url`. Without one it is refused.
- **`press()`** takes Playwright's key names and `+` chords.
- **`upload()`** writes each file to disk first: the browser must share the
  test's file system.

## Component testing

`@nightwatch/react` and `@nightwatch/vue` mount a component through Vite. Mount,
then build the env as in e2e:

```ts
await browser.mountComponent('/src/LoginForm.tsx')
const form = new LoginFormHarness(nightwatch(browser))
```

Under React 19, point the plugin's generated mount script at `react-dom/client`
(see `test-apps/nightwatch-ct/vite.react.config.ts`): `@nightwatch/react` 3.1
otherwise falls back to `ReactDOM.render`, which React 19 removed.
`@nightwatch/vue` imports `@vue/test-utils` from the app's own `node_modules`, so
install it there.

## Gherkin (Nightwatch's Cucumber runner)

Nightwatch launches a browser per scenario in its own `Before`.
`Before(nightwatchEnv)` turns it into the world's env:

```ts
import { Before, setWorldConstructor, When } from '@cucumber/cucumber'
import { definePages } from '@harnessed-ts/gherkin'
import { HarnessedWorld, nightwatchEnv } from '@harnessed-ts/gherkin/nightwatch'

const pageMap = { checkout: CheckoutPage }
class AppWorld extends HarnessedWorld<{ checkout: CheckoutPage }, typeof pageMap> {
  override pages = definePages(pageMap)
}
setWorldConstructor(AppWorld)
Before(nightwatchEnv)

When('I open the {page} page', async function (this: AppWorld, name: 'checkout') {
  this.bag.checkout = this.open(name)
  await this.bag.checkout.goto()
})
```
