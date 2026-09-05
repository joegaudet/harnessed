# @harnessed-ts/playwright

Playwright driver for `@harnessed-ts/core`, plus two extras this setup earned:

- `createApiStubs` — fulfil API requests from an in-memory object, so a browser
  suite runs with no backend, with a flag to hit the real one instead.
- `withWorld` (`@harnessed-ts/playwright/bdd`) — a scenario-scoped bag for the route
  harnesses a Gherkin scenario builds up, so steps do not share a module-level
  `let` that breaks when a worker is reused.

```ts
import { pw } from '@harnessed-ts/playwright'
import '@harnessed-ts/playwright/matchers'

const form = new LoginFormHarness(pw(page))
```

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
