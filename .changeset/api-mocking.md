---
'@harnessed-ts/mock': minor
'@harnessed-ts/core': minor
'@harnessed-ts/page': minor
'@harnessed-ts/dom': minor
'@harnessed-ts/playwright': minor
'@harnessed-ts/puppeteer': minor
'@harnessed-ts/webdriverio': minor
'@harnessed-ts/testcafe': minor
'@harnessed-ts/cypress': minor
'@harnessed-ts/ember': minor
'@harnessed-ts/vitest-browser': minor
'@harnessed-ts/storybook': minor
'@harnessed-ts/gherkin': minor
'@harnessed-ts/chai': minor
'@harnessed-ts/qunit': minor
'@harnessed-ts/eslint-plugin': minor
'@harnessed-ts/claude': minor
'@harnessed-ts/conformance': minor
---

API mocking, the same under every runner. The new `@harnessed-ts/mock` holds one handler model and each driver registers the transport that intercepts requests under its runner: `page.route` under Playwright, request interception under Puppeteer, a request hook under TestCafe, one catch-all `cy.intercept` under Cypress, an agent injected by a WebDriver BiDi preload script under WebdriverIO, and `fetch`, XHR and `WebSocket` patched in the page (through `@mswjs/interceptors`, an optional peer) under Testing Library, Ember, Vitest browser mode and Storybook. Every driver has a `/mock` entry: `import { mock, json } from '@harnessed-ts/playwright/mock'`.

`mock(env, { scope, state, onUnhandled, openapi })` returns the mock for that env's network. Handlers come three ways — the fluent `api.get('/api/users/:id').once().delay(200).reply(…)`, MSW-shaped tables (`http.get`, `graphql.query`), and API harness classes (`@Api`, `@Get`, `@Post`…) overridable per route — and the newest matching handler answers. Builders cover JSON, text, HTML, XML, bytes, files, forms, server-sent events, NDJSON, chunked streams, every common status, RFC 9457 problem details, JSON:API and GraphQL results, network errors, aborts and hangs; `defineFactory` builds deterministic test data. A request in scope that nothing answers fails the test, naming it. Requests are logged with parsed bodies, `waitFor` waits for one, and `toHaveBeenRequested`, `toHaveBeenRequestedTimes` and `toHaveBeenRequestedWith` join every driver's matchers (`requested`/`requestedWith` for Chai, `assert.requests(route)` for QUnit). Mocks can be validated against an OpenAPI document, a GraphQL schema (`@harnessed-ts/mock/graphql`) or a Standard Schema, typed from openapi-typescript output with `typedApi`, replayed from a HAR (recorded under Playwright and Puppeteer), and built from existing MSW handlers. `api.ws()` mocks WebSockets everywhere but TestCafe; streams are delivered in pieces under the in-page runners and WebdriverIO, and whole elsewhere. `resetMocks()` ends every mock after a test; `@harnessed-ts/mock/vitest`, Ember's `setupMocks(hooks)`, Playwright's `withMocks(test)`, Cypress's support import and Storybook's preview do it for you.

`@harnessed-ts/core` adds `registerBeforeNavigate`, and `PageHarness.goto()` awaits it: a mock is intercepting before the page loads. A page may declare the mocks it always needs with `get mocks()`. Storybook stories declare theirs in `parameters.harnessed.mocks` (with `harnessed()` from `@harnessed-ts/storybook/mock`), Gherkin worlds expose `mocks`, and the conformance catalog gains a data view (in React and its Glimmer port) and `mockSpecs`, run by every runner.

`createApiStubs` in `@harnessed-ts/playwright` is now built on `mock()` and deprecated; it is removed in the next minor. `@harnessed-ts/eslint-plugin` adds `no-raw-intercept` and `await-mock-install`, and `@harnessed-ts/claude` documents mocking for each detected runner, with an API harness template.
