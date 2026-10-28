# @harnessed-ts/nightwatch

Nightwatch driver for `@harnessed-ts/core`. Selectors resolve in the page through
the shared resolver — the same code the Testing Library driver runs — and
selenium-webdriver, under Nightwatch's `browser.driver`, does the clicking and
typing.

```ts
import { harnessedChai } from '@harnessed-ts/chai'
import { nightwatch } from '@harnessed-ts/nightwatch'
import * as chai from 'chai'

chai.use(harnessedChai)
const { expect } = chai

describe('sign in', function () {
  it('signs in', async function () {
    const login = new LoginPage(nightwatch(browser))
    await login.goto() // browser.navigateTo(), resolved against launch_url
    await login.form.fillIn({ email: 'ada@example.com', password: 'hopper' })
    await expect(login.form.errorQuery).to.be.absent
  })
})
```

The same spec runs under Nightwatch's own test runner and under its Mocha
runner (`test_runner: { type: 'mocha' }`). Assertions are
[`@harnessed-ts/chai`](https://www.npmjs.com/package/@harnessed-ts/chai)'s, on
Chai's own `expect` rather than the `expect` global Nightwatch installs for its
element assertions. Frames are entered through WebDriver, so a harness nested
in a cross-origin frame works too. Component tests (`@nightwatch/react`) and
Gherkin (`@harnessed-ts/gherkin/nightwatch`) build the env the same way.

Needs Nightwatch 3. Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
