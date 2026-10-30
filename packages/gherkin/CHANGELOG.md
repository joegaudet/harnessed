# @harnessed-ts/gherkin

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
  - @harnessed-ts/nightwatch@0.8.0

## 0.7.0

### Minor Changes

- ec06bdf: Vue, Solid, Svelte and Angular join React and Ember as conformance-tested UI frameworks, and node:test, Bun and Nightwatch join the runners.

  New packages: `@harnessed-ts/nightwatch` drives Nightwatch 3 through the injected resolver, under Nightwatch's own runner and its Mocha runner, in end-to-end and component tests (`@nightwatch/react`, `@nightwatch/vue`), with cross-origin frames. `@harnessed-ts/angular` drives zoneless Angular 21+: every action settles at `fixture.whenStable()`, or at the `ApplicationRef`'s for an app bootstrapped without TestBed, and `goto()` drives a provided router.

  `@harnessed-ts/core/register` loads TypeScript harnesses under `node --import`: esbuild strips the types, lowers standard decorators and `accessor`, and compiles JSX. `@harnessed-ts/core/bun` does the same as a `bun test` preload, so harnesses keep the standard decorator protocol whatever `experimentalDecorators` the tsconfig sets.

  `@harnessed-ts/dom/matchers/bun` registers the matchers with `bun:test`. The dom driver runs on happy-dom too: it focuses the frames leading to an interaction's target, finds a frame's `<iframe>` where `frameElement` is unset, and reads a select's selection off `options`.

  `@harnessed-ts/resolve/webdriver` holds the WebDriver half of injected resolution, shared by the WebdriverIO and Nightwatch drivers. `@harnessed-ts/gherkin/nightwatch` adapts the cucumber-js world to Nightwatch's Cucumber runner.

  `@harnessed-ts/playwright`, and `@harnessed-ts/cypress` under `realEvents`, give the page a task after every action, so a read straight after it sees what a framework that renders on a timer (zoneless Angular) has rendered. The injectable resolver installs on the page's `window` rather than the script's global, which under Firefox's WebDriver is a sandbox in front of it.

  `@harnessed-ts/conformance` exports `fixtureParity()`, the per-view parity check a port of the fixture to another framework runs, naming the first place its markup parts from the React original; it detects a simulated DOM from the DOM's own window.

  `@harnessed-ts/eslint-plugin` recognises Nightwatch's, Angular's and Vue Test Utils' raw queries, and looks in `nightwatch/` by default. `npx @harnessed-ts/claude install` detects Angular, Nightwatch, node:test and Bun.

### Patch Changes

- Updated dependencies [ec06bdf]
  - @harnessed-ts/core@0.7.0
  - @harnessed-ts/nightwatch@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [e324e94]
  - @harnessed-ts/core@0.6.0

## 0.5.0

### Patch Changes

- @harnessed-ts/core@0.5.0

## 0.4.0

### Minor Changes

- 9666a3d: New `@harnessed-ts/gherkin`: a scenario-scoped world, a typed page registry (`definePages`) and a `{page}` parameter type (`pageParameter`) that rejects an unknown page name at step matching, with adapters for playwright-bdd (`/playwright-bdd`, `withWorld`), cucumber-js (`/cucumber`, `HarnessedWorld`), @badeball/cypress-cucumber-preprocessor (`/cypress`, `cypressWorld`) and ember-cli-yadda or plain Yadda (`/yadda`, `yaddaWorld`, with a `$page` term from `pageDictionary`). `@harnessed-ts/playwright/bdd` re-exports `withWorld` from it, deprecated for one release.

### Patch Changes

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
