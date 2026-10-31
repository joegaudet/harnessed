# @harnessed-ts/cypress

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
  - @harnessed-ts/resolve@0.8.0

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
  - @harnessed-ts/resolve@0.7.0

## 0.6.0

### Minor Changes

- e324e94: ember-test-selectors style test ids: `configure({ testIdAttribute: 'data-test-*' })` makes `testId('x')` match any element that has the attribute `data-test-x`, whatever its value, with the same scoping, strictness, `{ global: true }`, frame and absence rules as before under every driver. A plain attribute name keeps matching by value. A presence id is held to letters, digits, `-`, `_`, `.` and `:`, and anything else (or a `RegExp`) is refused rather than spliced into a selector.

  `Query.boundingBox()` resolves to `{ x, y, width, height }`: the target's border box in CSS pixels, relative to the top-level viewport, offset by every frame crossed. Strict, and on an absent target it rejects after the timeout, as `text()` does. A node that draws no box reads as all zeros, and so does every node under the dom driver: jsdom computes no layout.

  `Query.upload(files)` sets the files of an `<input type="file">`, or of the input a `<label>` is for, and fires `input` and `change`, replacing any earlier selection. It refuses any other element, and several files for an input that is not `multiple`. Puppeteer, WebdriverIO and TestCafe take only paths, so there each `File` is written to a temporary directory first: its name and bytes arrive, and the browser infers its type from the extension.

  `Query` gains two abstract members, so a driver outside this repo implements both to keep compiling; the conformance catalog pins all three changes.

  `@harnessed-ts/eslint-plugin` supports ESLint 8.57 and legacy `.eslintrc`: the peer range is now `>=8.57`, `legacy-recommended` and `legacy-strict` name the rules under `@harnessed-ts/`, and the CJS build exposes `rules` and `configs` at the top level, where eslintrc reads them.

  `npx @harnessed-ts/claude install` detects ember-test-selectors attributes (in `.gts`, `.gjs` and `.hbs` files too) and writes `testIdAttribute: 'data-test-*'`.

  `@harnessed-ts/storybook` writes and finds its story-ready marker under a `data-test-*` config, where `StoryPage` waits for it.

### Patch Changes

- Updated dependencies [e324e94]
  - @harnessed-ts/core@0.6.0
  - @harnessed-ts/resolve@0.6.0

## 0.5.0

### Patch Changes

- @harnessed-ts/core@0.5.0
  - @harnessed-ts/resolve@0.5.0

## 0.4.0

### Minor Changes

- 9666a3d: A new Cypress driver for e2e and component tests: `cy.harness(Cls, async h => …)` runs a harness inside one command against the application under test, `cy.visitPage(Page, params)` visits a page's `urlFor()` and waits for it to be ready, and `goto()` works inside the bridge in e2e tests. Interactions use user-event by default, or trusted Chrome DevTools Protocol input with `realEvents: true` on Chromium.
- 1823546: `isVisible()`, `waitFor('visible')` and `waitFor('hidden')` on a target matching
  several nodes now reject with the shared strict-mode violation, at once, under
  every driver. The dom, Ember, Vitest browser mode and Cypress drivers answered
  `false` from `isVisible()`, waited out the timeout in `waitFor('visible')`, and —
  worse — resolved `waitFor('hidden')` at once, passing a wait for three rendered
  nodes to disappear; Playwright's waits raised its own wording instead of the
  shared one. An `nth()`
  past the last match answers `false` from `isVisible()` and counts as hidden, as it
  does under Playwright — Puppeteer and TestCafe used to reject it as an index out
  of range.

  Core exports `StrictModeViolation`, the class `strictViolation()` now returns, so a
  driver can tell ambiguity apart from absence. It is the class a caller catches
  under every driver: core also exports `reviveStrictViolation()`, which the
  Puppeteer, WebdriverIO and TestCafe drivers apply to what the page throws, so
  a violation raised in the page arrives as core's class, worded exactly as an
  in-process driver words it. `instanceof StrictModeViolation` checks a brand
  rather than the prototype, so it holds across two copies of core in one page —
  Cypress bundles the support file and each spec separately.

  `WaitState` now documents the rule it is held to: a state joins only when every
  driver honours it with the same meaning, so a runner's own states — Playwright's
  `attached` and `detached` — stay out of the shared interface.

### Patch Changes

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
  - @harnessed-ts/resolve@0.4.0
