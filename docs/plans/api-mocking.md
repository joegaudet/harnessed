# Plan: API mocking, per runner and cross-platform

Status: implemented (see [As built](#as-built)) · Branch: `claude/modest-wright-ujvwcj` · Base: `main` @ `b9cb567` (0.6.0)

## Goal

One way to mock HTTP APIs that runs unchanged under every runner harnessed supports:
Testing Library (jsdom), Playwright, Ember (ember-qunit, ember-exam, Vitest browser),
Cypress (e2e and component), WebdriverIO, Vitest browser mode, Puppeteer, TestCafe and
Storybook, with Gherkin on top. A test declares what the backend says; the driver owns
how the request is caught, just as it owns how a click is dispatched.

The bar is the same as for queries: **conformance parity**. A new `mocks.catalog.ts`
runs, unchanged, under every driver on every PR. Where a runner physically cannot do
something (true streaming under Cypress, say), that is a documented difference in the
support matrix, not a silent gap.

The package also ships response builders for the formats and API styles real apps
use, so a test says `json(user)` or `jsonApi.resource('users', user)` or
`problem({ status: 422 })` rather than hand-assembling headers.

## Decisions (from the clarifying round)

| #   | Topic              | Decision                                                                                                                         |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Interception       | Native hook per runner. One neutral handler model, one adapter per driver                                                        |
| 2   | Packaging          | New `@harnessed-ts/mock`: handler model, builders, registry, request log. Drivers implement a small adapter                      |
| 3   | `createApiStubs`   | Reimplemented on the new API as a shim, deprecated, removed in the following minor                                               |
| 4   | Runners in v1      | All drivers, Storybook included                                                                                                  |
| 5   | In-page engine     | `@mswjs/interceptors` (fetch + XHR) where a runner has no out-of-page hook. Optional peer dependency                             |
| 6   | jsdom scope        | fetch + XHR only; Node `http`/`https` are not intercepted                                                                        |
| 7   | Mirage / Pretender | Coexist. Ours installs on top; unmatched requests fall through to what was there. Order documented                               |
| 8   | Hook choice        | Native wherever the runner has one (`cy.intercept` in Cypress CT too); in-page only where it doesn't                             |
| 9   | Authoring shape    | Both: a handler-table core and a fluent builder that compiles to it                                                              |
| 10  | Class form         | "API harnesses": `@Api` classes with `@Get`/`@Post`… decorators, alongside the functional form                                   |
| 11  | Handler execution  | In the test process. Native hooks round-trip each request to the handler, so handlers are real closures                          |
| 12  | Cypress handlers   | Sync or async, run in the spec realm through `cy.intercept`'s `req.reply`, exposed through a `cy.mock` bridge                    |
| 13  | Body formats       | JSON, text, HTML; bytes, files, blobs; form data, urlencoded, XML; SSE, NDJSON, chunked                                          |
| 14  | API styles         | GraphQL, JSON:API, RFC 9457 problem details, WebSockets                                                                          |
| 15  | Status shortcuts   | Named: `notFound()`, `unauthorized()`, `serverError()`, `noContent()`, `created()`, `redirect()`… plus `status(n, body)`         |
| 16  | Network faults     | `networkError()`/abort, `.delay(ms)` and global latency, `hang()`, `offline()`                                                   |
| 17  | Streaming parity   | Best effort. Truly incremental where the runner can; elsewhere all chunks at once, footnoted                                     |
| 18  | Matching           | `:param` paths with typed params, globs and RegExp, `.withQuery/.withHeaders/.withBody`, `.where(predicate)`                     |
| 19  | Relative paths     | Match on any origin; an absolute URL pins the origin. `baseUrl` configurable                                                     |
| 20  | Precedence         | Last registered wins. An exhausted `.once()`/`.times(n)` handler falls through                                                   |
| 21  | Unmatched requests | `onUnhandled: 'error' \| 'warn' \| 'bypass' \| fn`, default `'error'`, naming the request and the nearest candidates             |
| 22  | Policing scope     | Only requests under configured `scope` prefixes. Assets, HMR and fonts never trip it                                             |
| 23  | Request log        | `calls` / `lastCall` with parsed bodies, plus `toHaveBeenRequested` in every matcher package (`expect`, Chai, `assert.harness`)  |
| 24  | Waiting            | `await api.waitFor('POST /api/orders')`, on the harness timeout config, resolving with the request                               |
| 25  | State              | A typed state object, cloned per test, handed to every handler: the `createApiStubs` model, generalised. No ORM                  |
| 26  | Factories          | `defineFactory<T>()` with deterministic sequences, `.build()` / `.buildList()`. No faker dependency                              |
| 27  | Schemas            | OpenAPI response + request validation, OpenAPI-typed routes, GraphQL SDL validation, Standard Schema (Zod, Valibot…) bodies      |
| 28  | HAR                | v1: record where the runner can, replay everywhere                                                                               |
| 29  | Lifecycle          | Bound to the env: `const api = mock(env)`. Adapters reset per test through the runner's hooks; `reset()`/`dispose()` as fallback |
| 30  | Before navigation  | Guaranteed. `goto()` awaits pending installs; a conformance spec covers requests fired on load                                   |
| 31  | Pages              | Optional page-level defaults: a page can declare the API harnesses it needs, installed on `goto()`, overridable per test         |
| 32  | Gherkin            | `world.mocks` in steps; no built-in step library                                                                                 |
| 33  | Storybook          | `parameters.harnessed.mocks` on meta/story, installed in-page by the preview decorator, so mocks show in the Storybook UI too    |
| 34  | MSW interop        | Import: `api.useMsw(handlers)` runs existing MSW handlers through our adapters                                                   |
| 35  | Conformance        | New `specs/mocks.catalog.ts`; the fixture gains a data screen (fetch, XHR, GraphQL, SSE, WS) in React and the Ember port         |
| 36  | Tooling            | Lint: no raw intercepts, unawaited installs. `claude`: authoring skill + templates for API harnesses and factories               |
| 37  | Release            | Phased on `main`, published together as the next minor (0.7.0)                                                                   |
| 38  | Order              | Core → reference drivers → other browser drivers → in-page drivers → API styles → schemas/HAR/MSW → tooling + docs               |
| 39  | Docs               | A "Mocking" column in the support matrix (gaps footnoted), a README section with per-runner snippets, a `docs/site` section      |
| 40  | Plan output        | This file                                                                                                                        |

## Non-goals

- Node-level `http`/`https` interception under jsdom (decision 6). Nothing else in
  the matrix could match it, so it would be a parity hole by design.
- An in-memory database with generated CRUD routes (decision 25). Mirage exists; the
  state object covers what tests here need.
- Built-in Gherkin steps (decision 32).
- Exporting our handlers to MSW (decision 34). Import only.
- Faker or any random data (decision 26). Factories are deterministic.
- Mocking non-HTTP transports other than WebSockets (WebRTC, gRPC-web over raw
  streams, Server-Sent Events over anything but HTTP).

## How React and Ember are handled

Interception is a property of the **runner**, not the UI framework. A React app and
an Ember app both call `fetch` (Ember Data's default adapter included) or
`XMLHttpRequest` (jQuery-era Ember, axios in the browser); what differs is where the
test runs relative to the page, and that decides the adapter:

| Where the test runs                 | Examples                                                                         | Adapter                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Outside the page, drives a browser  | Playwright, Puppeteer, WebdriverIO, TestCafe, Cypress e2e — React or Ember build | Native network hook; handler runs in the test process                       |
| Inside the page, with a native hook | Cypress component testing                                                        | `cy.intercept` (decision 8)                                                 |
| Inside the page, no native hook     | jsdom (RTL), ember-qunit / ember-exam, Vitest browser, Storybook                 | `@mswjs/interceptors` patching `fetch` + XHR in the page realm (decision 5) |

So:

- **React under RTL**: the dom adapter patches jsdom's `fetch`/XHR. React Query, SWR,
  Apollo and axios all go through those.
- **React under Playwright/Cypress/etc.**: the native hook, no app changes.
- **Ember rendering and application tests** (ember-qunit, ember-exam, Vitest
  browser): the tests share the page's realm, so the ember adapter installs the
  in-page interceptor and resets it in `hooks.afterEach` through a
  `setupMocks(hooks)` helper, the same shape as `setupRenderingTest`. Requests made
  during `visit()` are caught because install completes before the test body.
- **Ember under Playwright/Cypress e2e** (`test-apps/playwright-ember`,
  `cypress-ember`): native hook, like any other built app.
- **Mirage/Pretender**: also patch `fetch`/XHR. Our interceptor installs after the
  app boots, so it sits on top; an unmatched request is passed to whatever was
  there, so Mirage still answers it (decision 7). `onUnhandled: 'error'` only fires
  for requests inside `scope` that nothing — ours or Mirage — answered, detected by
  Pretender's own unhandled hook when present.
- **JSON:API** (decision 14) is first-class because it is Ember Data's default wire
  format; it is equally usable from a React app.

## Architecture

### A. The handler model (`@harnessed-ts/mock`, runtime-neutral)

Everything compiles to one shape, which is what adapters consume:

```ts
interface MockHandler<State> {
  readonly method: HttpMethod | '*'
  readonly matcher: UrlMatcher // :param path, glob, RegExp, or absolute URL
  readonly where?: RequestPredicate // query, headers, body, custom
  readonly remaining?: number // .once() / .times(n)
  respond(req: MockRequest, ctx: MockContext<State>): MockReply | Promise<MockReply>
}
```

- `MockRequest`: method, URL, typed `params`, `query`, headers, and lazy body parsers
  (`json()`, `text()`, `formData()`, `bytes()`), plus `graphql` (operation name,
  variables) when it parses as one.
- `MockReply`: a serialisable description — status, headers, body (string, bytes,
  or a chunk iterable), `delay`, or a fault (`networkError`, `hang`). Adapters
  never see a `Response` object; a description crosses every realm boundary that a
  native hook puts in the way.
- `MockContext<State>`: the per-test state (decision 25), the call log, and
  `passthrough()` to send this one request to the real network.

The registry is a last-wins stack (decision 20). Matching is pure, in `mock`, and
shared by every adapter, so no runner re-implements precedence.

### B. Three authoring layers over that model

```ts
// 1. Handler table (MSW-shaped, portable between suites)
const handlers = [
  http.get('/api/users/:id', ({ params }) => json(users.build({ id: params.id }))),
  http.post('/api/users', async ({ request }) => created(await request.json())),
]

// 2. Fluent builder, compiled to the same handlers
const api = mock(env, { scope: ['/api/**'], state: { users: [] as User[] } })
await api
  .get('/api/users/:id')
  .reply(({ params, state }) => json(state.users.find(u => u.id === params.id)))
await api
  .post('/api/orders')
  .once()
  .delay(200)
  .reply(problem({ status: 422, detail: 'Out of stock' }))
await api.get('/api/feed').reply(sse([{ data: 'hello' }, { event: 'done' }]))

// 3. API harnesses (decision 10), a class per backend resource
@Api({ base: '/api/users' })
class UsersApi extends ApiHarness<{ users: User[] }> {
  @Get('/:id') byId({ params, state }) {
    return json(state.users.find(u => u.id === params.id)) ?? notFound()
  }
  @Post('/') create({ body }) {
    return created(body)
  }
}
await api.use(UsersApi)
await api.use(UsersApi, { byId: () => serverError() }) // per-test override, method by name
```

`@Api`/`@Get` use the same 2023-11 decorators as harnesses, so they need nothing
beyond the existing Babel preset.

### C. Builders (decisions 13–16)

`@harnessed-ts/mock/builders` — tree-shakeable, pure functions returning `MockReply`:

| Group     | Builders                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body      | `json`, `text`, `html`, `xml`, `bytes`, `blob`, `file(path \| URL)`, `formData`, `urlencoded`                                                                 |
| Streaming | `sse(events, { interval })`, `ndjson(items)`, `chunked(parts)`                                                                                                |
| Status    | `status(n, body?)`, `ok`, `created`, `accepted`, `noContent`, `redirect(url, 301\|302\|307\|308)`, `notModified`                                              |
| Errors    | `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `tooManyRequests(retryAfter)`, `serverError`, `badGateway`, `unavailable` |
| Problem   | `problem({ status, type, title, detail, instance, ...ext })` — RFC 9457, `application/problem+json`; `validationProblem({ field: [msgs] })`                   |
| JSON:API  | `jsonApi.resource(type, attrs, { relationships, included, meta })`, `jsonApi.collection(...)`, `jsonApi.errors([...])`, `jsonApi.noContent()`                 |
| GraphQL   | `graphql.query('GetUser', fn)`, `graphql.mutation(...)`, `graphql.operation(...)`, `gqlData(data)`, `gqlErrors([...])`, partial data+errors                   |
| Faults    | `networkError()`, `abort()`, `hang()`; `api.offline()` / `api.online()`; `.delay(ms)` and `mock(env, { latency })`                                            |
| Headers   | Every builder takes `{ headers, cookies }`; `withCors()` for cross-origin APIs                                                                                |
| Factories | `defineFactory<T>(defaults)` with `seq()`, `oneOf()`, traits; `.build(overrides)`, `.buildList(n, overrides)`, `.reset()` per test                            |

`file()` reads from disk in the test process; under the in-page adapters it is
resolved at install time and shipped as bytes, since the page has no filesystem.

### D. WebSockets (decision 14)

`api.ws('wss://example.com/socket')` returns a handle with `onConnection`,
`onMessage(fn)`, `send(data)`, `close(code)`. Native under Playwright
(`page.routeWebSocket`), Puppeteer/WDIO via CDP/BiDi where available; in-page via
`@mswjs/interceptors`' WebSocket interceptor elsewhere — which includes Cypress,
since `cy.intercept` cannot see sockets. Gaps footnoted per decision 17.

### E. The driver adapter (one per driver)

Registered like navigation, so core stays dependency-free:

```ts
// @harnessed-ts/mock
export interface MockTransport {
  install(env: EnvConfig, dispatch: Dispatch): Promise<Disposable>
  readonly capabilities: { streaming: boolean; websockets: boolean; harRecord: boolean }
}
export function registerMockTransport(driver: string, t: MockTransport): void
```

`dispatch(request) → MockReply | 'unhandled'` is the shared matcher; each adapter
only translates a native request in and a `MockReply` out.

| Driver           | Hook                                                       | Streaming | WS        | HAR record          |
| ---------------- | ---------------------------------------------------------- | --------- | --------- | ------------------- |
| `dom`            | `@mswjs/interceptors` in jsdom                             | ✓         | ✓ in-page | —                   |
| `playwright`     | `page.route` / `context.route`, `routeWebSocket`           | buffered¹ | ✓         | ✓ `routeFromHAR`    |
| `puppeteer`      | `setRequestInterception` + `request.respond`               | buffered¹ | CDP       | via CDP log         |
| `webdriverio`    | `browser.mock` (BiDi) / CDP; Classic falls back to in-page | buffered¹ | BiDi      | BiDi network events |
| `testcafe`       | `RequestHook` (`onRequest`/`onResponse`)                   | buffered¹ | in-page   | —                   |
| `cypress` e2e/CT | `cy.intercept` + `req.reply`, behind `cy.mock`             | buffered¹ | in-page   | —                   |
| `vitest-browser` | in-page interceptors (provider varies)                     | ✓         | ✓ in-page | —                   |
| `ember`          | in-page interceptors, `setupMocks(hooks)`                  | ✓         | ✓ in-page | —                   |
| `storybook`      | in-page interceptors from the preview decorator            | ✓         | ✓ in-page | —                   |

¹ All chunks delivered in one response; SSE consumers still see every event, but not
spaced in time. Where the hook genuinely streams in a given runner version the
adapter uses it, and the footnote names the version.

Handlers run in the test process (decision 11): the native hooks already hand the
request to Node and await the answer. For in-page adapters the test and page share a
realm, so there is no round trip at all.

### F. Lifecycle (decisions 29–31)

- `mock(env, options)` returns an `ApiMock` bound to that env. Installing is async
  and idempotent; every adapter resets between tests through the runner's own hook
  (Playwright fixture teardown, Cypress's automatic intercept reset, QUnit
  `hooks.afterEach`, Vitest `onTestFinished`, TestCafe `t.removeRequestHooks`).
- `PageHarness.goto()` awaits any pending install on its env before navigating
  (decision 30). Implemented through a new `pendingInstalls(env)` registry hook in
  core, so `page` does not depend on `mock`.
- Pages may declare defaults with a getter, matching `path`:

  ```ts
  class UsersPage extends PageHarness {
    get path() {
      return '/users'
    }
    get mocks() {
      return [UsersApi]
    }
  }
  ```

  `goto()` installs them if `@harnessed-ts/mock` is loaded; per-test `api.use()`
  calls win by precedence. In jsdom (no `goto`) the same list is installed by
  `expectReady()`'s first call — or explicitly with `api.useFor(UsersPage)`.

### G. Assertions and waiting (decisions 23–24)

- `api.calls(matcher?)`, `api.lastCall(matcher?)`, and each handle's `.calls`.
- Matchers, added to the existing packages rather than a new one:
  `expect(handle).toHaveBeenRequested()`, `.toHaveBeenRequestedTimes(n)`,
  `.toHaveBeenRequestedWith({ query, body, headers })`; Chai `requested`/`requestedWith`;
  QUnit `assert.harness(handle).wasRequested()`.
- `await api.waitFor('POST /api/orders', { timeout })` uses `timeoutFor(env)`.

### H. Schemas (decision 27)

`@harnessed-ts/mock/openapi`, `/graphql` and Standard Schema support in the core:

- `mock(env, { openapi: spec })` validates every mocked response, and every request
  the app makes, against the document; a mismatch fails the test naming the path and
  the schema pointer. `validate: 'responses' | 'requests' | 'both' | false`.
- `typedApi<paths>()` (from openapi-typescript output) types `api.get(path)`, its
  params and its reply body, so a typo in a path is a type error.
- GraphQL: `mock(env, { graphqlSchema: sdl })` validates operation results.
- Any Standard Schema (Zod, Valibot, ArkType) passed as `.withBody(schema)` or
  `.reply(schema, value)` both types and validates.
- `openapi`/`graphql` validators are optional peers, loaded only when used.

### I. HAR (decision 28)

- `api.fromHar(file, { match: 'url' | 'url+body', notFound })` replays on every
  runner by compiling entries into handlers, so replay goes through the same
  adapters and precedence.
- `api.recordHar(file)` on Playwright, Puppeteer and WDIO (BiDi); elsewhere it throws
  a readable refusal naming the runners that can, like `navigationFor`.

### J. MSW import (decision 34)

`api.useMsw(handlers)` wraps MSW `RequestHandler`s: our transport catches the request,
MSW's `getResponse` resolves it, and the resulting `Response` is serialised to a
`MockReply`. `msw` is an optional peer.

### K. Runner surfaces

- **Cypress:** `cy.mock(api => api.get(...).reply(...))` and `cy.waitForRequest(...)`,
  registered by `@harnessed-ts/cypress/support`, mirroring `cy.harness`.
- **Ember:** `setupMocks(hooks, options)` returns the `ApiMock` for the module.
- **Storybook:** `parameters: { harnessed: { mocks: [UsersApi, handlers], state } }`
  on meta or story; the `harnessed()` decorator installs before render, so mocked
  stories work interactively too. In `play`, `context.harnessed.mocks` is the same
  instance for overrides and assertions.
- **Gherkin:** `world.mocks` on the scenario-scoped world, reset with the world.
- **Playwright:** also a `mocks` fixture in `@harnessed-ts/playwright/fixtures` for
  people who want one; the core API needs no fixture.

### L. Conformance

- Fixture: a `DataScreen` in `packages/conformance/fixture` (and its Glimmer port,
  held by the fixture-parity test) that loads a user via `fetch` on mount, a list via
  XHR, a GraphQL query, an SSE feed, a WebSocket, a form POST, and a file download —
  each rendering its result or its error state.
- `specs/mocks.catalog.ts`, run by every driver's runner: JSON reply, every status
  shortcut, problem details shown, network error shown, delay observed (spinner
  present then absent), `hang` keeps spinner, request on load caught before `goto`,
  precedence and `.once()` fallthrough, unmatched in-scope fails / out-of-scope
  passes, request log and `waitFor`, state mutation across requests, GraphQL by
  operation name, JSON:API document, SSE events all arrive, WS echo, HAR replay,
  MSW handler import, reset between tests.
- Capability-gated specs (streaming timing, WS, HAR record) read
  `transport.capabilities`; the matrix footnotes are generated from the same flags,
  so documented gaps cannot drift from tested ones.

## Phases

Each phase's definition of done: the gate from CONTRIBUTING.md passes, the
conformance catalog is green on every driver that phase touches, and the README and
`docs/site/` reflect what landed (per CLAUDE.md, ticking the Website box).

### Phase 1 — Core and builders

- New `packages/mock`: handler model, matcher (`:param`, glob, RegExp, absolute),
  last-wins registry, `.once/.times/.delay/.where/.withQuery/.withHeaders/.withBody`,
  request log, `waitFor`, state cloning, `onUnhandled` + `scope`.
- `@harnessed-ts/mock/builders`: body, status, error, problem, fault builders;
  `defineFactory`.
- `ApiHarness`, `@Api`, `@Get/@Post/@Put/@Patch/@Delete/@Head/@Options/@All`.
- `registerMockTransport` and a test transport for unit tests.
- `pendingInstalls(env)` hook in core; `PageHarness.goto()` awaits it and installs
  `mocks` defaults.

### Phase 2 — Reference drivers: `dom` and `playwright`

- dom transport over `@mswjs/interceptors`.
- Playwright transport over `page.route`; `createApiStubs` reimplemented on it and
  marked `@deprecated` (decision 3).
- Fixture `DataScreen` (fetch, XHR, form, download parts) and `mocks.catalog.ts` core
  specs; `toHaveBeenRequested*` in both drivers' `expect` matchers.

### Phase 3 — Other out-of-page browser drivers

- Puppeteer, WebdriverIO (BiDi, Classic fallback), TestCafe, Cypress e2e + CT with
  `cy.mock`/`cy.waitForRequest`. Chai matchers.
- Each driver's `test-apps/` conformance run gains the mocks catalog.

### Phase 4 — In-page drivers

- Ember (`setupMocks(hooks)`, Mirage coexistence, QUnit `wasRequested`), Vitest
  browser, Storybook (`parameters.harnessed.mocks`, preview decorator).
- Ember port of `DataScreen`; fixture-parity test extended.
- Gherkin `world.mocks`.

### Phase 5 — API styles and transports

- GraphQL matching + builders, JSON:API builders, streaming builders (SSE, NDJSON,
  chunked), WebSockets on every transport (native or in-page per §D).
- Fixture gains GraphQL, SSE and WS parts; capability-gated specs.

### Phase 6 — Schemas, HAR, MSW

- OpenAPI validation and `typedApi`, GraphQL SDL validation, Standard Schema.
- `fromHar` everywhere, `recordHar` where capable.
- `useMsw`.

### Phase 7 — Tooling, docs, release

- ESLint: `no-raw-intercept` (flags `page.route`, `cy.intercept`,
  `setRequestInterception`, `browser.mock`, `RequestMock` in test files) and
  `await-mock-install` (an unawaited `api.*().reply()` / `api.use()` before `goto`,
  `render` or `visit`).
- `claude`: authoring-skill section on mocks; templates for an `ApiHarness` and a
  factory; runner detection wires the right setup (`setupMocks`, `cy.mock` support).
- README: "Mocking" column in the support matrix with footnotes generated from
  capabilities, a "Mocking APIs" section, a snippet in each "Using with …" section,
  `@harnessed-ts/mock` in the package table.
- `docs/site/`: matrix column, packages list, and a mocking snippet.
- Changesets for every touched package; publish together as **0.7.0**.
- `createApiStubs` removal is scheduled for 0.8.0.

## Risks and open points

- **Realm crossing under Cypress.** `req.reply` runs in the spec realm, but
  `file()` and OpenAPI validation want Node. Cypress transport resolves files via
  `cy.task` at install time and runs validation in the spec realm with the
  browser-safe validator build; to confirm in Phase 3.
- **WebdriverIO Classic** has no network interception. Falls back to the in-page
  transport (injected through the existing page script), which misses requests made
  before injection — so "before navigation" (decision 30) holds on BiDi only.
  Footnoted; to confirm acceptable before Phase 3 lands.
- **TestCafe** `RequestHook` handlers are async but its mock body must be complete,
  so streaming is buffered there for good.
- **Interceptor ordering with Mirage** depends on install order at boot; covered
  by an ember-classic test app that runs Mirage.
- **Payload size** of round-tripping every in-scope request to Node: measured in
  Phase 2 on the conformance suite; `scope` keeps assets out of it by default.

## As built

Everything above shipped, with these departures — each forced by a runner, and
each pinned by the catalog rather than left as a footnote alone:

- **WebdriverIO intercepts in the page, not at the network.** Holding requests at
  a BiDi network intercept pauses the navigation they belong to, and a Classic
  command waiting on that navigation (the driver's own `execute/sync` polls)
  then deadlocks the session. A page agent — `@mswjs/interceptors` bundled into
  one script at build time, `@harnessed-ts/mock/remote-page` — is injected by a
  BiDi preload script, which runs before the page's own scripts, so the
  before-navigation guarantee holds, and it streams. There is no in-page fallback
  for Classic: a Classic session refuses with a readable error, and the Classic
  conformance run asserts that refusal for every mock spec. HAR recording is
  Playwright's and Puppeteer's.
- **TestCafe stages a network failure** by sending the request where nothing
  listens, since its hook can mock a response but not fail one. It has no
  WebSocket hook and no channel back from the page, so `api.ws()` refuses there.
- **Cypress registers one catch-all `cy.intercept` per test** from a `beforeEach`
  that `@harnessed-ts/cypress/mock` adds, and routes each request to the live
  mock: a harness runs inside one promise, where no `cy` command can be
  enqueued. WebSockets go through a shim on `window:before:load`. The Cypress
  runs could not be executed where this was built (the binary download is
  blocked there); they typecheck, and CI runs them.
- **WebSockets without a native hook** (Puppeteer, WebdriverIO, Cypress) share
  one page shim and bridge (`wsShim`, `WsBridge`), each transport supplying only
  its two string channels.
- **`resetMocks()` ends every mock** rather than clearing it: a test that mocks
  nothing must not be policed by an earlier one's scope. `api.reset()` is the
  in-test clear. The Glimmer parity test pins the data view with its first
  request held open (`hang()`), since `render()` awaits settling and React's
  tree is read in the same tick.
- **A page's declared mocks under jsdom** are installed with `api.useFor(Page)`
  before `render`; `goto()` installs them everywhere else. Installing from
  `expectReady()` would be too late: the requests fire on render.
- **`delay` specs** assert the reply arrives no sooner than its delay, and the
  loading state only when the view came back before the reply was due: TestCafe
  waits for a page's requests before an action returns.
- **Storybook** mocking comes from `@harnessed-ts/storybook/mock`'s `harnessed()`,
  so the main entry does not require `@mswjs/interceptors`.
- **`no-raw-intercept`** is off for driver sources in this repo's own lint config:
  the drivers are where each runner's interception belongs.
- **Release:** `@harnessed-ts/mock` has never been published, so its first
  release needs the one-off `bootstrap-publish.yml` dispatch, then a trusted
  publisher configured for it on npm.
