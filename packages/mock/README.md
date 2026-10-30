# @harnessed-ts/mock

API mocking for [harnessed](https://github.com/joegaudet/harnessed): one handler
model and one set of response builders, and an adapter per test runner. The same
mocks run under Testing Library, Playwright, Ember, Cypress, WebdriverIO, Vitest
browser mode, Puppeteer, TestCafe and Storybook, held to one conformance catalog.

```bash
npm i -D @harnessed-ts/mock
npm i -D @mswjs/interceptors   # Testing Library, Ember, Vitest browser, Storybook
```

Import from your driver's `/mock` entry, which registers its transport and
re-exports everything here:

```ts
import { created, json, mock, notFound } from '@harnessed-ts/playwright/mock'

const api = mock(pw(page), { scope: '/api/**', state: { users: [ada] } })
await api
  .get('/api/users/:id')
  .reply(({ params, state }) => state.users.find(user => user.id === params.id) ?? notFound())
await api
  .post('/api/orders')
  .once()
  .reply(created({ id: 1 }))
await checkout.goto()
```

- **Handlers** three ways: the fluent builder above, MSW-shaped tables
  (`http.get`, `graphql.query`), and API harness classes (`@Api`, `@Get`, …)
  with per-route overrides. The newest matching handler answers.
- **Builders** for JSON, text, HTML, XML, bytes, files, forms, server-sent
  events, NDJSON, every common status, RFC 9457 problems, JSON:API, GraphQL,
  network errors and hangs; `defineFactory` for test data.
- **Unanswered requests fail the test.** Requests are logged with parsed bodies;
  `waitFor` and the `toHaveBeenRequested*` matchers check them.
- **Validation** against an OpenAPI document, a GraphQL schema
  (`@harnessed-ts/mock/graphql`) or a Standard Schema; typed routes with
  `typedApi`; HAR replay and recording; MSW handlers with `useMsw`; WebSockets
  with `api.ws()`.
- **`resetMocks()`** ends every mock after a test;
  `@harnessed-ts/mock/vitest` is a Vitest setup file that does it.

A driver outside this repo registers a `MockTransport` with
`registerMockTransport(driverId, transport)`; `@harnessed-ts/mock/in-page` and
`@harnessed-ts/mock/remote-page` hold the two shared implementations.

Full guide: [Mocking APIs](https://github.com/joegaudet/harnessed#mocking-apis).

MIT © Joe Gaudet, Jay Seo
