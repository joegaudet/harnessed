# @harnessed-ts/chai

Chai assertions for [harnessed](https://github.com/joegaudet/harnessed#readme)
harnesses: Mocha, ember-mocha, Cypress, WebdriverIO under Mocha — anything that
asserts through Chai.

```ts
import * as chai from 'chai'
import { harnessedChai } from '@harnessed-ts/chai'
chai.use(harnessedChai)
```

```ts
await expect(banner).to.be.absent
await expect(card).not.to.be.selected
await expect(price).to.readAs(/^\$/)
```

`absent`, `selected` and `readAs` take a target or a harness and return a
promise: reading the page goes through a driver, so **await every one** — an
un-awaited assertion cannot fail the test. `.not` negates as usual. The failure
messages are the same ones the Vitest, Playwright and QUnit assertions use.

Works with Chai 4, 5 and 6.

MIT © Joe Gaudet, Jay Seo
