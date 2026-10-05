# Plan: Ember, QUnit/BDD, Gherkin, Cypress, and the other e2e runners

Status: draft · Branch: `docs/multi-runner-plan` · Base: `main` @ `28b3d93` (0.3.0)

## Goal

A harness written once runs unchanged under every runner a team is likely to use: Ember
(QUnit, Mocha, Vitest browser mode, ember-exam), Cypress (e2e and component), Gherkin
(playwright-bdd, cucumber-js, Cypress cucumber, ember-cli-yadda), WebdriverIO, Vitest
browser mode, Puppeteer, and TestCafe. As today, the bar is **conformance parity**:
each new driver runs the whole `@harnessed-ts/conformance` catalog (guarantees 1–10 plus
the page specs) with no per-driver opt-out, on every PR.

The README gets a support matrix plus a "Using with …" section for each supported
library. Each phase updates the README as part of its definition of done; it is not
left for the end.

## Decisions (from the clarifying round)

| #   | Topic             | Decision                                                                                                                     |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ember driver      | New `@harnessed-ts/ember`. Interactions go through `@ember/test-helpers` and await `settled()`                               |
| 2   | Decorators        | Ship a Babel preset that applies the 2023-11 transform to harness files only; app code keeps legacy decorators               |
| 3   | Ember floor       | 5.12 LTS+, classic ember-cli **and** Embroider+Vite                                                                          |
| 4   | Ember runners     | ember-qunit, ember-mocha, Vitest browser mode, ember-exam compatibility                                                      |
| 5   | Ember test types  | Rendering **and** application tests. `registerNavigation('ember')` maps onto `visit` / `currentURL`                          |
| 6   | QUnit API         | Fluent `await assert.harness(x).isAbsent()`, in the qunit-dom style                                                          |
| 7   | BDD assertions    | One shared `@harnessed-ts/chai` plugin                                                                                       |
| 8   | Fixture           | Port the fixture per framework (a Glimmer copy for Ember). E2E drivers reuse the served React fixture                        |
| 9   | Gherkin runners   | playwright-bdd, @cucumber/cucumber, @badeball/cypress-cucumber-preprocessor, ember-cli-yadda                                 |
| 10  | Gherkin depth     | World plus page registry (`definePages`, `{page}` parameter type). Step bodies stay hand-written                             |
| 11  | Gherkin packaging | `@harnessed-ts/gherkin` core with one subpath per runner. `@harnessed-ts/playwright/bdd` becomes a re-export                 |
| 12  | Cypress model     | Promise driver plus a `cy.harness()` bridge. Harness classes stay unchanged                                                  |
| 13  | Cypress modes     | E2E and component testing                                                                                                    |
| 14  | Other e2e         | WebdriverIO, Vitest browser mode, Puppeteer, TestCafe                                                                        |
| 15  | Order             | Foundations → Ember → Cypress → Gherkin → the rest                                                                           |
| 16  | README            | Support matrix plus per-library sections, each linking to that package's README                                              |
| 17  | CI                | Every driver on every PR, sharded, all required                                                                              |
| 18  | Release           | One coordinated release. **0.3.0 is already published, so this is 0.4.0** (see Phase 7)                                      |
| 19  | Lint / claude     | Raw-query lint rules for each runner, runner detection plus templates in `claude`, `testIdAttribute` pushed into each driver |
| 20  | Plan output       | This file                                                                                                                    |

## Non-goals

- Ember component testing under Cypress. Cypress has no supported Ember mount, so Ember
  gets component coverage from its own runners.
- Cross-origin iframes under Cypress or the dom-family drivers. Guarantee 10's
  documented difference is extended to cover them; it is not worked around.
- Generating steps from harness methods (decision 10).
- A chainable, Cypress-native facade (decision 12). It can come later on top of the bridge.

## Architecture changes that enable all of this

### A. One resolver, used by many drivers: `@harnessed-ts/resolve`

`packages/dom/src/resolve.ts` already implements the hard semantics: role with `level`,
label, strictness checked before waiting, frame entry, and `testIdAttribute` sync. It
sits on `@testing-library/dom`, which works against **any** `Document`. Moving it into
its own package makes it the single source of truth for every driver that can run
JavaScript in the page:

| Consumer                               | How it uses the resolver                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `dom`                                  | unchanged, imports from the new package                                                                                 |
| `ember`                                | resolves against `getRootElement()`, then acts with `@ember/test-helpers`                                               |
| `cypress`                              | resolves against the AUT `document` inside the bridge                                                                   |
| `vitest-browser`                       | runs in the page directly                                                                                               |
| `webdriverio`, `puppeteer`, `testcafe` | an IIFE build (`@harnessed-ts/resolve/inject`) is injected and called through `execute` / `evaluate` / `ClientFunction` |

The payoff is that guarantees 2, 3, 4, 5, and 10 cannot diverge between those drivers,
because the same code decides them. Playwright keeps its own native locators.

### B. Browser-safe conformance specs

`specs/catalog.ts` and `specs/pages.catalog.ts` import `node:assert/strict`. That does
not exist inside Testem, Cypress, or Vitest browser mode. Replace it with a small
internal `specs/assert.ts` (`equal`, `ok`, `rejects`, `deepEqual`) whose failure
messages are no worse than node's. This is a refactor and the existing two runners must
stay green.

### C. `PageHarness.urlFor(params)`

Cypress cannot navigate from inside a promise, so `cy.visitPage(Page, params)` needs the
URL without navigating. Expose the existing path substitution as a public
`urlFor(params)`. This also helps TestCafe and WebdriverIO.

### D. Matchers in three shapes, one implementation

`harnessMatchers` in core stays the only implementation. The new adapters are:

- `@harnessed-ts/qunit` adds `assert.harness(x)` → `{ isSelected, isAbsent, readsAs }`. Each returns a promise and calls `assert.pushResult`.
- `@harnessed-ts/chai` adds `await expect(x).to.be.absent`, `.selected`, and `.readAs(re)` (thenable assertions).
- Driver `/matchers` entry points for `expect.extend` runners (Vitest browser, WebdriverIO's expect, Puppeteer under Jest or Vitest).

## Phases

Every phase follows the repo's TDD rhythm. First wire the driver's conformance runner
and confirm it is **red**, because the driver does not exist yet. Then build the driver
until the runner is green. Each phase's definition of done includes:

- its CI job, required
- its package README
- its root README section and matrix row
- a changeset
- the `reviewer` agent run before opening the PR

### Phase 0: Foundations

| Step | Work                                                                                                                                                                                                                                                                             | Test first                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | Browser-safe `specs/assert.ts` (B)                                                                                                                                                                                                                                               | Refactor: dom and playwright conformance stay green                                                                                      |
| 0.2  | Extract `@harnessed-ts/resolve` from `dom` (A). Add the `/inject` IIFE build, which takes `testIdAttribute` as an argument rather than through global config                                                                                                                     | Refactor for `dom`. A new unit spec checks that the inject bundle has no bare imports and runs in a blank page                           |
| 0.3  | `@harnessed-ts/core/babel` preset: 2023-11 decorators, `accessor`, and class fields scoped by `include` (default `**/*.harness.{ts,js}`, `**/harness/**`, `**/*.page.{ts,js}`). Two scenarios: Embroider (`babel.config.cjs`) and classic (`ember-cli-build.js` `babel.plugins`) | A fixture project whose app code uses legacy `@tracked` and whose harness uses `accessor` both compile; a decorated field has its getter |
| 0.4  | `PageHarness.urlFor(params)` (C)                                                                                                                                                                                                                                                 | Page spec: `urlFor` matches what `goto` navigates to, including repeated params                                                          |
| 0.5  | `@harnessed-ts/chai`                                                                                                                                                                                                                                                             | Mocha suite against `dom`, covering pass, fail, and negation messages                                                                    |
| 0.6  | `@harnessed-ts/qunit`                                                                                                                                                                                                                                                            | QUnit (node runner) suite against `dom`, same cases                                                                                      |
| 0.7  | Glimmer port of the fixture (`packages/conformance/fixture-ember/`): LoginForm, CardGrid, PortalDialog (`{{#in-element}}`), Wizard, FramedPanel. Same `viewSearch` addressing                                                                                                    | Next row: the parity check                                                                                                               |
| 0.8  | **Fixture-parity check**, the guard decision 8 needs: render each view in both fixtures and compare a normalized accessibility tree (role, name, level, test-id, nesting). Drift fails CI                                                                                        | Introduce a deliberate drift and watch it go red                                                                                         |
| 0.9  | CI: turn the per-driver job template into a reusable workflow (`.github/workflows/conformance-driver.yml`) so each later phase adds one required job                                                                                                                             | n/a                                                                                                                                      |

### Phase 1: `@harnessed-ts/ember`

**Env.** `ember({ root?: Element })` defaults to `getRootElement()`.
`{ global: true }` starts at `document.body` so `{{in-element}}` and wormhole portals
outside the testing container are reachable. This mirrors how `dom` treats
`baseElement`.

**Query.**

- Resolution goes through `@harnessed-ts/resolve`.
- Actions map onto `@ember/test-helpers`: `click`, `fillIn`, `typeIn`, `select`,
  `triggerEvent('mouseenter')`, `focus`, `blur`, and `triggerKeyEvent`. Each is applied
  to the resolved **element**, never to a string selector, so strictness and scope are
  ours.
- Every action ends at `settled()`.
- `waitForVisible` and `waitForHidden` retry within the configured timeout, and end at
  once on a strict violation or a frame that cannot be entered.
- `count()` does not wait, which keeps guarantee 1.

**Navigation.** `registerNavigation('ember', { goto: visit, currentUrl: currentURL, waitForUrl })`
is available in application tests. Under a rendering test, `goto` refuses with the
standard message, because no router has been set up.

**Frames.** Same-origin only, the same as `dom`. The refusal names the frame.

**Test apps.** `test-apps/ember-vite` (Ember 6 blueprint, Embroider+Vite) and
`test-apps/ember-classic` (ember-cli). Both consume the shared conformance specs and the
Glimmer fixture, compiled with the Phase 0.3 preset. ember-try covers 5.12 LTS and
latest.

**Runners.**

| Runner              | Matrix                             | Wiring                                                                                                                 |
| ------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ember-qunit         | 5.12 and latest × classic and vite | the conformance catalog as `test()`s in rendering and application modules, plus `@harnessed-ts/qunit`                  |
| ember-mocha         | latest, vite                       | the catalog as `it()`s plus `@harnessed-ts/chai`. Pin a version and flag the package's maintenance state in the README |
| Vitest browser mode | latest, vite                       | the catalog under Vitest browser mode with the Ember driver (test-helpers run in the page)                             |
| ember-exam          | latest, vite                       | `ember exam --split=3 --random --parallel` must pass. This proves no shared module state leaks between harnesses       |

**README.**

- A "Using with Ember" section covering Babel preset setup for both builds, rendering
  and application test examples, QUnit and Mocha assertions, and an ember-exam note.
- New matrix rows.
- An addition to the documented differences: `isVisible()` is a real layout check here
  (Testem runs a browser), so it matches Playwright rather than jsdom.

### Phase 2: `@harnessed-ts/cypress`

**Bridge.** `cy.harness(Cls, async h => { … }, { timeout })` is one `cy.then` that:

1. builds `cypress({ document: AUT document, window })`,
2. constructs the harness,
3. awaits the callback.

Its timeout defaults to `defaultTimeout × 4`. `cy.then`'s 4 s default would otherwise
cut long harness flows short. Each `Query` action writes a `Cypress.log` entry, so the
command log still tells the story.

**Interactions.** This corrects a premise of the original answer to question 12. Commands
such as `trigger` or `realClick` cannot be enqueued from inside a promise, so:

- **Default:** `@testing-library/user-event` bound to the AUT document. It works in all
  browsers and behaves the same as the `dom` driver.
- **Opt-in `realEvents: true`:** CDP input through `Cypress.automation('remote:debugger:protocol', …)`,
  which is promise-based. Chromium only.

**Navigation.**

- `cy.visitPage(Page, params)` = `cy.visit(page.urlFor(params))`, then `cy.harness(Page, p => p.expectReady())`.
- Inside the bridge, `goto()` refuses with a message pointing at `cy.visitPage`. This is
  a third documented difference, alongside `isVisible` and `check`.
- `currentUrl` and `waitForUrl` read the AUT `location` and work inside the bridge.

**Component testing.** `cy.mount(<LoginForm/>)` then `cy.harness(LoginFormHarness, …)`,
proven against the React fixture through `@cypress/react`.

**Assertions.** `@harnessed-ts/chai` inside the bridge: `await expect(form).to.be.absent`.

**Conformance.**

- `test-apps/cypress-e2e` runs the catalog and page specs against the served React
  fixture.
- `test-apps/cypress-ct` runs the component catalog.
- Electron and Chrome are required. Firefox runs without `realEvents`.

**README.** A "Using with Cypress" section covering e2e and component setup, the bridge,
`visitPage`, `realEvents`, and the frames and `goto` differences.

### Phase 3: `@harnessed-ts/gherkin`

**Core.** This part is runner-agnostic.

- `createWorld<W>()` returns a per-scenario bag. It is today's `withWorld` idea, freed
  from Playwright.
- `definePages({ checkout: CheckoutPage, … })` is a typed registry.
- `world.page('checkout')` constructs the page against the scenario's env.
- `pageParameter(registry)` returns a cucumber-expression `{page}` definition whose
  regexp is built from the registry keys, so an unknown page name fails at step
  matching, not deep inside a step.

**Adapters.** Each one owns its runner's lifecycle.

| Subpath           | Runner                                  | World lifecycle                                                                                                        |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/playwright-bdd` | playwright-bdd                          | fixture, as `withWorld` today. `@harnessed-ts/playwright/bdd` re-exports it, deprecated for one release (like `route`) |
| `/cucumber`       | @cucumber/cucumber                      | a `HarnessedWorld` base for `setWorldConstructor`. Env comes from a user-supplied `Before` (Playwright or WebdriverIO) |
| `/cypress`        | @badeball/cypress-cucumber-preprocessor | world reset in `beforeEach`. Steps reach it through `world()`, never through `this`                                    |
| `/yadda`          | ember-cli-yadda                         | a library factory that injects the world and an Ember env. `$page` is a dictionary converter                           |

**Conformance.** A small `gherkin` spec set runs under each adapter, written as one
feature file shared by all four:

- the world starts empty
- the world carries a page across steps
- nothing leaks between scenarios
- `{page}` resolves a registered page and rejects an unknown one
- `transitionTo` works through the world

**README.** A "Gherkin" section with one setup snippet per runner, plus a matrix
column.

### Phase 4: The remaining drivers

These can run in parallel once Phase 0 lands. Give each agent its own package and test
app, with no overlapping file scope.

| Driver                         | Resolution                                                      | Actions                                                                        | Navigation                                      | Frames                                                                                                                                     | Matchers                                              |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `@harnessed-ts/webdriverio`    | injected resolver via `browser.execute`, returning element refs | WebDriver element actions (`click`, `setValue`, `selectByVisibleText`, `keys`) | `browser.url`, `getUrl`                         | `switchFrame`. Cross-origin works                                                                                                          | expect-webdriverio `/matchers`, plus chai under Mocha |
| `@harnessed-ts/vitest-browser` | in-page `@harnessed-ts/resolve`                                 | `userEvent` from `vitest/browser` (provider-native, real events)               | none, like `dom`                                | same-origin                                                                                                                                | `/matchers` via `expect.extend`                       |
| `@harnessed-ts/puppeteer`      | injected resolver via `page.evaluateHandle`                     | `ElementHandle` actions                                                        | `page.goto`, `page.url`                         | `contentFrame()`. Cross-origin works                                                                                                       | `/matchers` (Jest or Vitest)                          |
| `@harnessed-ts/testcafe`       | injected resolver as a `Selector(fn)` client function           | `t.click`, `t.typeText`, …, with the `t` controller held in the env            | `t.navigateTo`, `ClientFunction` for `location` | **Risk:** `switchToIframe` is stateful on `t`, so a scope chain through frames has to switch in and out around each call. Spike this first | chai, or plain values                                 |

Each driver also gets:

- a conformance runner in `test-apps/<driver>`
- strictness checked before acting (guarantee 2)
- `count()` that does not wait (guarantee 1)
- `testIdAttribute` passed into the injected resolver on every call

**README.** One "Using with …" section and a matrix row per driver.

### Phase 5: Lint, claude, config

**`no-raw-locator-in-test` and `no-page-or-screen-in-harness`.** Each runner adds its
patterns. A pattern applies only when its import source or global is present, so `$`
from jQuery is not a false positive.

| Runner         | Patterns                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Cypress        | `cy.get`, `cy.contains`, `cy.find`, `cy.findBy*`                                                                                |
| Ember          | `find` / `findAll` / `click('<selector>')` with a string selector, `this.element.querySelector*`, `assert.dom(…)` on a selector |
| WebdriverIO    | `$` / `$$`                                                                                                                      |
| Puppeteer      | `page.$`, `page.$$`, `page.locator`, `page.waitForSelector`                                                                     |
| TestCafe       | `Selector(`                                                                                                                     |
| Vitest browser | `page.getBy*`                                                                                                                   |

Tests for each are red first in `packages/eslint-plugin`.

**`claude`.**

- `detect.ts` recognises:
  - Ember: `ember-cli-build.js` or `@embroider/*` deps. Layout is `app/components`,
    `app/routes` → pages, `tests/harness`.
  - Cypress: a `cypress/` dir or `cypress.config.*`.
  - WebdriverIO: `wdio.conf.*`.
  - TestCafe: `.testcaferc.*`.
  - Puppeteer: the dependency.
- `install` writes runner-specific skill templates and example tests.

**Config.** `testIdAttribute` already flows through `testIdSync` for every
resolver-based driver. Injected drivers take it per call. `applyConfig` documents a
single setup-file line for each runner.

### Phase 6: README consolidation

Each phase has already added its own section. This phase makes the whole thing read as
one document.

1. **Support matrix** near the top. Rows are Testing Library (jsdom), Playwright,
   Ember (QUnit, Mocha, Vitest browser, ember-exam), Cypress (e2e, CT), WebdriverIO,
   Vitest browser, Puppeteer, and TestCafe. Columns are component harness, page and
   `goto`, matchers / assertion style, Gherkin adapter, frames (same-origin /
   cross-origin), and conformance status.
2. **Install** lists every driver plus `chai`, `qunit`, `gherkin`, and `resolve`.
3. **Required setup** gets a third path: the Babel preset for Ember, for both builds.
4. **"Using with …"** sections, in matrix order, each one screen long, linking to the
   package README:
   - Testing Library
   - Playwright
   - Ember: QUnit, Mocha, Vitest browser, ember-exam
   - Cypress
   - Gherkin: playwright-bdd, cucumber-js, Cypress cucumber, ember-cli-yadda
   - WebdriverIO
   - Vitest browser
   - Puppeteer
   - TestCafe
5. **Cross-driver guarantees.** The "documented differences" list gains:
   - Cypress `goto` (use `cy.visitPage`)
   - Cypress, dom, and Ember frames are same-origin only
   - TestCafe frame switching
   - `isVisible` (real layout everywhere except jsdom)
6. **Packages table** gets every new package. **Adding a driver** points at
   `@harnessed-ts/resolve` and `/inject` as the shortcut to parity.
7. **Matchers** shows three side-by-side forms: `expect`, `assert.harness`, and chai.
8. A README test lifts every fenced `ts` block into a typecheck-only file, so the
   snippets cannot rot.

### Phase 7: Coordinated release (0.4.0)

`main` is already at **0.3.0**, and `.changeset/config.json` puts every package in one
`fixed` group, so the next coordinated version is **0.4.0**.

- Land phases on an integration branch, `next`. PRs target `next` and CI runs there as
  it does on `main`. This keeps `main` able to ship a 0.3.x patch without sweeping in
  unfinished drivers.
- Each PR still adds its changeset.
- Merging `next` into `main` produces one Version Packages PR, which releases 0.4.0.
- `bootstrap-publish.yml` handles first-time publication of each **new** package name,
  which OIDC cannot do (npm has no trusted publisher for a name that does not exist
  yet), with a short-lived `NPM_TOKEN`:
  - Dispatch it on the Version Packages branch, `changeset-release/main`, before merging
    the version PR. There every package is already at 0.4.0, so each new name's first
    published version is 0.4.0. Dispatched from `main`, it would publish 0.3.0 with
    `workspace:^` resolved to the old core, and that version can never be reused. The
    run publishes the whole 0.4.0 set, so push the `v0.4.0` tag by hand afterwards;
    the release run will find nothing left to publish.
  - Keep `NPM_TOKEN` in the `npm-bootstrap` GitHub Environment, with required reviewers
    and deployment branches limited to `main` and `changeset-release/*`, not as a
    repository secret. The workflow refuses any other branch on its own as well.
  - Afterwards, configure each package's trusted publisher (`release.yml`), revoke the
    token on npmjs.com and delete it from the environment, then delete the workflow.

## CI shape

The decision is every driver, required on every PR. Through a reusable workflow, the job
list is:

| Job                          | Matrix                                 |
| ---------------------------- | -------------------------------------- |
| `conformance-dom`            | as today                               |
| `conformance-playwright`     | as today                               |
| `conformance-ember-qunit`    | 5.12 and latest × classic and vite (4) |
| `conformance-ember-mocha`    | 1                                      |
| `conformance-ember-vitest`   | 1                                      |
| `conformance-ember-exam`     | 1                                      |
| `conformance-cypress-e2e`    | electron, chrome, firefox              |
| `conformance-cypress-ct`     | 1                                      |
| `conformance-webdriverio`    | chrome, firefox                        |
| `conformance-vitest-browser` | playwright provider                    |
| `conformance-puppeteer`      | 1                                      |
| `conformance-testcafe`       | chrome headless                        |
| `gherkin-<adapter>`          | ×4                                     |
| `fixture-parity`             | 1                                      |
| `readme-snippets`            | 1                                      |

That is about 25 jobs. Two things keep it affordable: a shared build artifact uploaded
once and downloaded by each job, and cached browser binaries. If it gets too slow, the
fallback is to drop to nightly for the heaviest jobs. That reverses decision 17, so it
would need your sign-off.

## Risks and open questions

1. **Babel preset scoping.** A harness that imports an app module using legacy
   decorators must not get the 2023-11 transform. The `include` glob is the boundary,
   and the 0.3 fixture proves it in both directions.
2. **Fixture drift (decision 8).** The 0.8 parity check is the mitigation. Without it,
   "both drivers agree" quietly stops meaning the same markup.
3. **ember-mocha maintenance.** If it breaks on Ember 6, the Mocha path needs a
   fallback (mocha via Vitest browser mode, or `ember-mocha` pinned). Decide when Phase
   1 is spiked.
4. **Cypress interaction fidelity.** user-event is synthetic. Teams that need trusted
   events get `realEvents` on Chromium only. Document it; don't hide it.
5. **TestCafe frames.** Spike before committing to the Phase 4 TestCafe slot. If scope
   chains through frames can't be made reliable, guarantee 10 becomes a documented
   refusal for TestCafe.
6. **Injected resolver size.** The `@testing-library/dom` IIFE is about 100 KB. It is
   injected once per page and re-injected after navigation. Measure the cost on the
   WebdriverIO run.
7. **The 0.4.0 timeline** depends on the slowest phase. If one driver stalls, ship
   without it or hold the release? Decide at the Phase 4 checkpoint.

## Suggested PR sequence

1. `refactor(conformance)`: browser-safe assert (0.1)
2. `refactor`: extract `@harnessed-ts/resolve`, plus `/inject` (0.2)
3. `feat(core)`: Babel preset (0.3)
4. `feat(page)`: `urlFor` (0.4)
5. `feat`: `@harnessed-ts/chai`, `@harnessed-ts/qunit` (0.5, 0.6)
6. `test(conformance)`: Glimmer fixture plus parity check (0.7, 0.8); `ci`: reusable driver workflow (0.9)
7. `feat(ember)`: driver plus ember-qunit runner (both builds, both versions)
8. `test(ember)`: ember-mocha, Vitest browser, ember-exam runners
9. `feat(cypress)`: driver, bridge, `visitPage`, e2e runner
10. `test(cypress)`: component testing runner
11. `feat(gherkin)`: core plus `/playwright-bdd` (migrate `withWorld`)
12. `feat(gherkin)`: `/cucumber`, `/cypress`, `/yadda`
13. `feat`: webdriverio · vitest-browser · puppeteer · testcafe (one PR each, in parallel)
14. `feat(eslint-plugin)`: rule patterns for each runner
15. `feat(claude)`: runner detection plus templates
16. `docs`: README consolidation plus snippet typecheck (Phase 6)
17. `chore(release)`: 0.4.0
