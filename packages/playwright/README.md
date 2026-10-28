# @harnessed-ts/playwright

Playwright driver for `@harnessed-ts/core`, plus two extras this setup earned:

- `createApiStubs` — **deprecated**, removed in the next minor: it is now built
  on `mock()` from `@harnessed-ts/playwright/mock`, which does the same under
  every runner. It fulfils API requests from an in-memory object, with a flag to
  hit the real backend instead.
- `withWorld` (`@harnessed-ts/playwright/bdd`) — **deprecated**, removed in the
  next minor: import it from `@harnessed-ts/gherkin/playwright-bdd`, beside the
  page registry and `{page}` parameter type. It adds a scenario-scoped bag for
  the pages a Gherkin scenario builds up.

```ts
import { pw } from '@harnessed-ts/playwright'
import '@harnessed-ts/playwright/matchers'

const form = new LoginFormHarness(pw(page))
```

**Mocking:** `import { mock, withMocks } from '@harnessed-ts/playwright/mock'` mocks through `page.route` and `page.routeWebSocket`; `withMocks(test)` adds a `mocks` fixture. See [Mocking APIs](https://github.com/joegaudet/harnessed#mocking-apis).

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
