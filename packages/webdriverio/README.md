# @harnessed-ts/webdriverio

WebdriverIO driver for `@harnessed-ts/core`. Selectors resolve in the page through
the shared resolver — the same code the Testing Library driver runs — and
WebDriver does the clicking and typing.

```ts
import { wdio } from '@harnessed-ts/webdriverio'
import '@harnessed-ts/webdriverio/matchers'
import { browser, expect } from '@wdio/globals'

const form = new LoginFormHarness(wdio(browser))
await form.fillIn({ email: 'ada@example.com' })
await expect(form).not.toBeAbsent()
```

Works under WebDriver BiDi (WebdriverIO's default) and Classic. Frames are
entered through WebDriver, so a harness nested in a cross-origin frame works too.
Under Mocha, `@harnessed-ts/chai` gives the same assertions in Chai's style.

Needs WebdriverIO 10. Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
