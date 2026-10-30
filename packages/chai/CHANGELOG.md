# @harnessed-ts/chai

## 0.8.0

### Minor Changes

- d00bf4e: API mocking, the same under every runner. The new `@harnessed-ts/mock` holds one handler model and each driver registers the transport that intercepts requests under its runner: `page.route` under Playwright, request interception under Puppeteer, a request hook under TestCafe, one catch-all `cy.intercept` under Cypress, an agent injected by a WebDriver BiDi preload script under WebdriverIO, and `fetch`, XHR and `WebSocket` patched in the page (through `@mswjs/interceptors`, an optional peer) under Testing Library, Ember, Vitest browser mode and Storybook. Every driver has a `/mock` entry: `import { mock, json } from '@harnessed-ts/playwright/mock'`.

  `mock(env, { scope, state, onUnhandled, openapi })` returns the mock for that env's network. Handlers come three ways — the fluent `api.get('/api/users/:id').once().delay(200).reply(…)`, MSW-shaped tables (`http.get`, `graphql.query`), and API harness classes (`@Api`, `@Get`, `@Post`…) overridable per route — and the newest matching handler answers. Builders cover JSON, text, HTML, XML, bytes, files, forms, server-sent events, NDJSON, chunked streams, every common status, RFC 9457 problem details, JSON:API and GraphQL results, network errors, aborts and hangs; `defineFactory` builds deterministic test data. A request in scope that nothing answers fails the test, naming it. Requests are logged with parsed bodies, `waitFor` waits for one, and `toHaveBeenRequested`, `toHaveBeenRequestedTimes` and `toHaveBeenRequestedWith` join every driver's matchers (`requested`/`requestedWith` for Chai, `assert.requests(route)` for QUnit). Mocks can be validated against an OpenAPI document, a GraphQL schema (`@harnessed-ts/mock/graphql`) or a Standard Schema, typed from openapi-typescript output with `typedApi`, replayed from a HAR (recorded under Playwright and Puppeteer), and built from existing MSW handlers. `api.ws()` mocks WebSockets everywhere but TestCafe; streams are delivered in pieces under the in-page runners and WebdriverIO, and whole elsewhere. `resetMocks()` ends every mock after a test; `@harnessed-ts/mock/vitest`, Ember's `setupMocks(hooks)`, Playwright's `withMocks(test)`, Cypress's support import and Storybook's preview do it for you.

  `@harnessed-ts/core` adds `registerBeforeNavigate`, and `PageHarness.goto()` awaits it: a mock is intercepting before the page loads. A page may declare the mocks it always needs with `get mocks()`. Storybook stories declare theirs in `parameters.harnessed.mocks` (with `harnessed()` from `@harnessed-ts/storybook/mock`), Gherkin worlds expose `mocks`, and the conformance catalog gains a data view (in React and its Glimmer port) and `mockSpecs`, run by every runner.

  `createApiStubs` in `@harnessed-ts/playwright` is now built on `mock()` and deprecated; it is removed in the next minor. `@harnessed-ts/eslint-plugin` adds `no-raw-intercept` and `await-mock-install`, and `@harnessed-ts/claude` documents mocking for each detected runner, with an API harness template.

### Patch Changes

- Updated dependencies [d00bf4e]
  - @harnessed-ts/mock@0.8.0
  - @harnessed-ts/core@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [ec06bdf]
  - @harnessed-ts/core@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [e324e94]
  - @harnessed-ts/core@0.6.0

## 0.5.0

### Patch Changes

- @harnessed-ts/core@0.5.0

## 0.4.0

### Minor Changes

- 9666a3d: Two new assertion packages, both backed by core's one matcher implementation so the messages read the same under every runner:

  - `@harnessed-ts/qunit`: `install(QUnit)` adds `assert.harness(x)` with `isAbsent`/`isPresent`, `isSelected`/`isNotSelected`, and `readsAs`/`doesNotReadAs`, reported through `pushResult`. For ember-qunit and any QUnit suite.
  - `@harnessed-ts/chai`: `chai.use(harnessedChai)` adds `absent`, `selected`, and `readAs`, awaitable and negatable. For Mocha, ember-mocha, Cypress, and WebdriverIO under Mocha.

  `harnessMatchers` results now carry `observed: { actual, expected }`, which the QUnit and Chai adapters report so their runners can show what was read.

### Patch Changes

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
