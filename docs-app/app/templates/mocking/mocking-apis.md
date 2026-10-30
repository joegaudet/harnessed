# Mocking APIs

**`@harnessed-ts/mock`** mocks the backend the same way under every runner. A test
says what the API answers; the driver owns how the request is caught — `page.route`
under Playwright, `cy.intercept` under Cypress, `fetch` and XHR patched in the page
under Testing Library, Ember, Vitest browser and Storybook. One handler model, one
set of response builders, one conformance catalog every runner passes.

```bash
npm i -D @harnessed-ts/mock
npm i -D @mswjs/interceptors   # for the in-page runners: Testing Library, Ember, Vitest browser, Storybook
```

Each driver re-exports everything from `@harnessed-ts/<driver>/mock` with its
transport registered:

```ts
import { created, json, mock, notFound, problem } from '@harnessed-ts/playwright/mock'

const api = mock(pw(page), { scope: '/api/**', state: { users: [ada] } })
await api
  .get('/api/users/:id')
  .reply(({ params, state }) => state.users.find(user => user.id === params.id) ?? notFound())
await api
  .post('/api/orders')
  .once()
  .delay(200)
  .reply(created({ id: 1 }))

const checkout = new CheckoutPage(pw(page))
await checkout.goto() // waits for the mocks to be installed first
await checkout.placeOrder()
await expect(api.lastCall('POST /api/orders')?.body).toEqual({ sku: 'A1' })
```

## Set up before the page loads, and await every install

`goto()` waits for a
mock on its env to be intercepting, so a request fired as the page loads is
caught. The newest matching handler answers; `.once()` and `.times(n)` fall
through once used, and a handler returning `undefined` declines.

## Three ways to write handlers

Three ways to write handlers, all compiled to the same thing:

```ts
// The fluent builder
await api.get('/api/users/:id').withQuery({ expand: 'team' }).reply(json(ada))

// A handler table — portable, and MSW-shaped
export const handlers = [
  http.get('/api/users/:id', ({ params }) => json(users.build({ id: params.id }))),
  graphql.query('GetProfile', () => gqlData({ profile: { handle: '@ada' } })),
]
await api.use(handlers)

// An API harness: a class per resource, like a harness per component
@Api({ base: '/api/users' })
class UsersApi extends ApiHarness<{ users: User[] }> {
  @Get('/:id') byId({ params, state }: MockRequest<{ id: string }, { users: User[] }>) {
    return state.users.find(user => user.id === params.id) ?? notFound()
  }
}
await api.use(UsersApi, { byId: () => serverError() }) // override a route by name
```

A page that always needs a backend declares it, and `goto()` installs it beneath
whatever the test registers: `get mocks() { return [UsersApi] }`.

## Matching

`:param` and OpenAPI `{param}` segments with typed params, `*` and
`**` globs, RegExps, absolute URLs to pin an origin (relative paths match any
origin), and `.withQuery`, `.withHeaders`, `.withBody(subset or Standard Schema)`
and `.where(predicate)` to tell apart requests to the same path.

## Builders

Builders set the status, content type and body, and take `{ status, headers,
cookies }`:

| Kind       | Builders                                                                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bodies     | `json`, `text`, `html`, `xml`, `bytes`, `file(path)`, `formData`, `urlencoded`                                                                                                                                                            |
| Streams    | `sse(events, { interval })`, `ndjson(items)`, `chunked(parts)` — piece by piece where the runner can stream                                                                                                                               |
| Status     | `status(n, body)`, `ok`, `created`, `accepted`, `noContent`, `redirect`, `notModified`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `tooManyRequests`, `serverError`, `badGateway`, `unavailable` |
| Problems   | `problem({ status, title, detail })` (RFC 9457), `validationProblem({ field: messages })`                                                                                                                                                 |
| API styles | `jsonApi.resource`, `jsonApi.collection`, `jsonApi.errors` (Ember Data's format); `gqlData`, `gqlErrors`                                                                                                                                  |
| Network    | `networkError()`, `abort()`, `hang()` (until the mock is reset), `passthrough()`, `.delay(ms)`, a `latency` option, `api.offline()`                                                                                                       |
| Test data  | `defineFactory<User>({ id: seq(String), role: oneOf('member', 'admin') })` with `.build()`, `.buildList(n)`, traits — deterministic, no faker                                                                                             |

## Unanswered requests fail the test

A request inside `scope` (by default, every
`fetch` and XHR) that no handler answers fails at the network level, and the
test fails naming it and the handlers that were registered. `onUnhandled: 'warn'`,
`'bypass'` or a function changes that.

## What was requested

`api.calls(filter)`, `api.lastCall(filter)` and each route's
`.calls`, with parsed bodies; `await api.waitFor('POST /api/orders')`; and matchers
in every assertion style — `toHaveBeenRequested`, `toHaveBeenRequestedTimes` and
`toHaveBeenRequestedWith({ body, query, headers })` on each driver's `expect`,
`requested`/`requestedWith` for Chai, `assert.requests(route)` for QUnit.

## Sockets, schemas, recordings

`api.ws('/socket')` mocks a WebSocket: push
with `send`, react with `onMessage`. `openapi: document` validates every mocked
exchange against an OpenAPI document — a reply the API could not send fails the
test — and `typedApi<paths>(api)` types paths, params and bodies from
openapi-typescript's output. `graphqlSchema(sdl)` from `@harnessed-ts/mock/graphql`
validates GraphQL operations and results; a Standard Schema (Zod, Valibot,
ArkType) validates a body with `.withBody(schema)` or a reply with `.returns(schema)`.
`api.fromHar(har)` replays a recording on any runner; `api.recordHar()` records
one under Playwright and Puppeteer. `api.useMsw(handlers)` runs existing MSW
handlers through any runner.

## End mocks after each test

End mocks after each test with `resetMocks()` — interception stops, and
anything left unverified fails the test. Within a test, `api.reset()` clears
handlers and keeps intercepting.

| Runner              | Import                              | After each test                                                         |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| Testing Library     | `@harnessed-ts/dom/mock`            | `@harnessed-ts/mock/vitest` as a setup file                             |
| Playwright          | `@harnessed-ts/playwright/mock`     | `withMocks(test)` for a `mocks` fixture, or `resetMocks()`              |
| Ember               | `@harnessed-ts/ember/mock`          | `setupMocks(hooks)`                                                     |
| Cypress             | `@harnessed-ts/cypress/mock`        | automatic, once imported from the support file; `cy.mock(api => …)`     |
| WebdriverIO         | `@harnessed-ts/webdriverio/mock`    | `afterEach(() => resetMocks())`                                         |
| Vitest browser mode | `@harnessed-ts/vitest-browser/mock` | `@harnessed-ts/mock/vitest` as a setup file                             |
| Puppeteer           | `@harnessed-ts/puppeteer/mock`      | `afterEach(() => resetMocks())`                                         |
| TestCafe            | `@harnessed-ts/testcafe/mock`       | `fixture(…).afterEach(() => resetMocks())`                              |
| Storybook           | `@harnessed-ts/storybook/mock`      | automatic between stories; stories declare `parameters.harnessed.mocks` |
| Gherkin             | the runner's, above                 | `this.mocks` on cucumber-js's world, `mocks` in a Yadda step            |
