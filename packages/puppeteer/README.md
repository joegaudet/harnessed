# @harnessed-ts/puppeteer

Puppeteer driver for `@harnessed-ts/core`. It injects the shared resolver into
the page, so selectors resolve exactly as they do under the other drivers, and
acts through `ElementHandle`s, so input is real browser input. Frames are entered
with `contentFrame()`, cross-origin ones included.

```ts
import { puppeteer } from '@harnessed-ts/puppeteer'
import '@harnessed-ts/puppeteer/matchers' // Vitest; under Jest, expect.extend(harnessMatchers)

const page = await browser.newPage()
const login = new LoginPage(puppeteer(page, { baseURL: 'http://localhost:3000' }))
await login.goto()
```

`baseURL` is what a page's relative `path` resolves against in `goto()`.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
