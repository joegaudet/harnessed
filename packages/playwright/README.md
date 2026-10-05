# @harnessed-ts/playwright

Playwright driver for `@harnessed-ts/core`, plus two extras this setup earned:

- `createApiStubs` — fulfil API requests from an in-memory object, so a browser
  suite runs with no backend, with a flag to hit the real one instead.
- `withWorld` (`@harnessed-ts/playwright/bdd`) — **deprecated**, removed in the
  next minor: import it from `@harnessed-ts/gherkin/playwright-bdd`, beside the
  page registry and `{page}` parameter type. It adds a scenario-scoped bag for
  the pages a Gherkin scenario builds up.

```ts
import { pw } from '@harnessed-ts/playwright'
import '@harnessed-ts/playwright/matchers'

const form = new LoginFormHarness(pw(page))
```

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
