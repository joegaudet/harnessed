# @harnessed-ts/vitest-browser

Vitest browser mode driver for `@harnessed-ts/core`. The test runs in the page, so
harnesses resolve there with the shared resolver, and every action goes through
the provider's `userEvent` — real browser input, not synthesised DOM events.

```ts
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import '@harnessed-ts/vitest-browser/matchers'
import { render } from 'vitest-browser-react'

await render(<LoginForm />)
const form = new LoginFormHarness(vitestBrowser())
```

Queries start at `document.body` by default, which is where portals land. Pass
`container` to scope a harness to one tree. Elements inside same-origin frames are
driven through the Playwright provider; component testing has no navigation, so a
page's `goto()` is refused.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
