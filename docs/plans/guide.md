# Plan: the harnessed guide

A multi-page guide at `https://joegaudet.com/harnessed/guide/`, built the same
way as the Formwright guide (`ember-formwright/docs-app`): an Ember app using
[Kolay](https://github.com/universal-ember/kolay) that turns markdown pages into
routes, with live examples on every page. The landing page at
`docs/site/index.html` stays as the pitch and links into the guide.

## Decisions (from the clarifying round)

| #   | Topic         | Decision                                                                                                   |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Authoring     | Markdown, rendered in Formwright's docs-app layout                                                         |
| 2   | URL           | `/harnessed/guide/`, next to the homepage                                                                  |
| 3   | Shape         | Multi-page with a sidebar, styled like Formwright                                                          |
| 4   | Audience      | App developers adopting harnessed                                                                          |
| 5   | Stack         | Clone Formwright's Kolay docs-app (Ember + Embroider/Vite + Kolay + Shiki)                                 |
| 6   | Example tabs  | Preview / Harness / Test, and the Test tab has a sub-tab for each runner                                   |
| 7   | Run in page   | A "Run test" button runs the harness against the live preview                                              |
| 8   | CI            | Every example has a real test that runs in CI                                                              |
| 9   | Runners       | All: Vitest (DOM + browser), Playwright, Cypress, QUnit/Ember, Puppeteer, TestCafe, WebdriverIO, Storybook |
| 10  | Topics        | Core authoring, page + route objects, Storybook + Gherkin, tooling                                         |
| 11  | Demo UI       | Ember `.gts` and React, with a framework toggle on each example                                            |
| 12  | Fixtures      | Reuse the conformance fixture (LoginForm, CardGrid, PortalDialog, FramedPanel, Wizard)                     |
| 13  | Snippets      | Runner tabs import the real specs (`?raw`) that CI already runs, so they can't drift                       |
| 14  | API reference | Generated from TypeScript declarations by Kolay's `<APIDocs>`                                              |
| 15  | Location      | `docs-app/` at the repo root                                                                               |
| 16  | Build         | Built in `pages.yml` into `_site/guide/`. Build output is not committed                                    |
| 17  | Non-DOM runs  | "Run test" uses the DOM driver. Every other runner tab links to a StackBlitz project that runs that runner |
| 18  | Homepage      | Unchanged apart from Guide links in the header and the use-case cards                                      |
| 19  | Shipping      | One PR                                                                                                     |
| 20  | Branch        | Stacked on `feat/storybook`, so the Storybook page can be written now                                      |

## What to copy from Formwright

From `ember-formwright/docs-app`, adapted rather than rewritten:

| Formwright file                         | harnessed use                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `vite.config.mjs`                       | Same plugins. `base` becomes `/harnessed/guide/`, Kolay `packages` lists the harnessed packages          |
| `app/router.ts`, `routes/*`             | Unchanged (`addRoutes(this)` + `properLinks`)                                                            |
| `app/templates/application.gts`         | Header (logo, Guide / Home / GitHub), sidebar from `meta.json` files                                     |
| `app/templates/**/meta.json` + `*.md`   | The page tree (see "Pages")                                                                              |
| `app/components/example.gts`            | Basis for `<Example>`; tabs change (see "The Example component")                                         |
| `app/highlight.ts`                      | Shiki, adding the `gherkin` grammar                                                                      |
| `app/styles/app.css`                    | Copied, then given the harnessed palette from `docs/site/site.css` and the logo                          |
| `tests/acceptance/pages-test.ts`        | Visits every page, checks there are no errors and runs axe                                               |
| `pnpm-workspace.yaml` Kolay workarounds | The `ember-repl@8` `packageExtensions`/patch and the `@glint/template` override, if they're still needed |

Formwright's theme preset/scheme pickers and its "model, live" panel go. In their
place: the framework toggle and a "Run test" results panel.

## The Example component

`<Example @name="login-form" @title="Signing in" />` reads
`docs-app/app/examples/<name>/`:

```
examples/login-form/
  index.ts          # { title, harness, ember: () => import(...), react: () => import(...), specs: {...} }
```

Each example points at existing files instead of copying them:

- **Harness:** `packages/conformance/fixture/harnesses/<X>Harness.ts`, imported `?raw`
  for the Harness tab and as a module for the Run button.
- **Preview (Ember):** the `.gts` port in `test-apps/ember-vite/app/components/fixture/`.
  To import it, either make the fixture components an exported subpath of a
  workspace package or move them into `packages/conformance/fixture/ember/`.
  Decide when building; don't duplicate them.
- **Preview (React):** `packages/conformance/fixture/components/<X>.tsx`, mounted
  by a small `react-island` modifier (`createRoot` on insert, `unmount` on
  destroy). That adds `react`/`react-dom` to docs-app only.
- **Test, one sub-tab per runner:** `?raw` imports of the spec CI already runs
  for that runner, mostly from `test-apps/demos/{rtl,playwright,cypress}` and the
  matching `test-apps/<runner>`. A runner with no fitting spec gets one added to
  its test-app, so CI runs it too.
- **Run test:** builds the harness with `dom({ container: previewElement })` and
  runs the example's `run` function (a few harness calls plus asserts, exported
  from the DOM spec), then shows each step as pass or fail. It uses the toggle's
  current framework, which is the "same harness, either framework" proof.
- **Non-DOM runner tabs:** an "Open in StackBlitz" link. Add one StackBlitz
  project per runner under `examples/` (as `examples/vitest-dom` already is).
  Playwright, Cypress and WebdriverIO need WebContainers that can run a browser.
  Check each one; a runner that can't run there shows its code and a
  "run locally" command instead.

## Pages

Sidebar groups, each a folder with a `meta.json`:

1. **Getting started:** Introduction (a live LoginForm example, install,
   "what a harness is"), Usage (the CLI installer and a first test).
2. **Writing harnesses:** Queries & locators, Child harnesses, Lists
   (`Listable`), Waiting, Strict mode, Test IDs & config.
3. **Runners:** one page per runner: Vitest DOM, Vitest browser, Playwright,
   Cypress (CT + e2e), QUnit / Ember, Puppeteer, TestCafe, WebdriverIO. Each
   covers setup and the driver import, with the LoginForm example shown with
   that runner's tab open.
4. **Beyond components:** Page objects (`@harnessed-ts/page`), Routes
   (`@harnessed-ts/route`), Portals & frames (PortalDialog, FramedPanel), API stubs (Playwright).
5. **Storybook & BDD:** Harnesses in `play()`, Stories as fixtures
   (`StoryPage`), Gherkin (cucumber, playwright-bdd, cypress).
6. **Tooling:** ESLint plugin, Chai matchers, Config, the Claude skill.
7. **Reference:** `<APIDocs>` for `@harnessed-ts/core`, `dom`, `page`, `route`,
   `storybook`.

Content comes from the README, the package READMEs and `docs/site/index.html`
use-case cards, rewritten for the guide. Package READMEs then link to their
guide page.

## Build and deploy

- `pnpm-workspace.yaml`: add `docs-app`.
- `docs-app/package.json` scripts: `build` (`HARNESSED_GUIDE=1 vite build --outDir dist`),
  `start`, `typecheck` (`ember-tsc --noEmit`), `test` (testem + QUnit, as in Formwright).
- `.github/workflows/pages.yml`: add `docs-app/**`, `packages/**/src/**` and
  `packages/conformance/fixture/**` to the trigger paths. Add pnpm
  setup/install, build the packages and docs-app, and copy `docs-app/dist`
  into `_site/guide/`, with a `404.html` copy for deep links.
- `.github/workflows/ci.yml`: a `guide` job that runs `pnpm --filter docs-app typecheck`
  and `test`.
- Root `package.json`: `guide:build` and `guide:start`.

## Tests (TDD order)

1. `tests/acceptance/pages-test.ts`: every page in the Kolay manifest renders
   with no console errors and no axe violations. It goes red first because
   there are no pages yet.
2. `tests/examples/<name>-test.gts`: for each example, under both frameworks,
   render the preview, click Run, and assert that every step passed. This also
   tests the toggle and the React island.
3. A unit test for the `react-island` modifier: mount, then unmount on destroy.
4. The existing runner specs that the tabs import already run in their test-apps' CI.

## Website sync (CONTRIBUTING "The website")

- `docs/site/index.html`: a Guide link in the header nav and a "Read the guide →"
  link on each use-case card and on the runners section.
- Tick the Website box in the PR template.

## Risks / open items

- **Kolay + this repo's toolchain.** Formwright needs a patched `ember-repl`
  and Node 24 for `ember-eslint-parser`. harnessed has `strictPeerDependencies`
  and a minimum-release-age policy, so Kolay's tree may need exclusions. Spike
  this first.
- **React inside Ember.** Two renderers on one page is fine with an island, but
  Glint won't type-check the TSX. Keep the island import untyped at the boundary
  with a typed wrapper (no `@ts-ignore`).
- **StackBlitz browser runners.** Playwright and Cypress in WebContainers are
  limited. The fallback is a "run locally" command for that tab.
- **Stacked on `feat/storybook`.** This PR's base is `feat/storybook` until that
  branch merges, then it's rebased onto `main`.
- **Size.** It ships as one PR, so review it in commit order: skeleton →
  Example component → pages → deploy.

## Spike findings (2026-10-14)

`docs-app/` on `feat/guide`: a Kolay skeleton with one page, building and
passing 5 QUnit tests. What it took:

- **Install.** The supply-chain policy passes. Strict peers needed two scoped
  `peerDependencyRules.allowedVersions`: `typedoc>typescript: 6` (Kolay) and
  `@babel/eslint-parser>eslint: 10`. The second is latent on `main`: frozen
  installs skip the check, but any re-resolve hits it.
- **Node 24.** Kolay calls `RegExp.escape`. docs-app pins Node 24.11.1 with
  `devEngines.runtime` (pnpm downloads it), so the rest of the repo stays on 22.
  The CI and Pages jobs for the guide need `node-version: 24`.
- **ember-repl.** It needs Formwright's patch and `packageExtensions` entry, copied
  as-is into `patches/` and `pnpm-workspace.yaml`.
- **Glint.** It needs a workspace override, `@glint/template: ^1.9.0`, because
  Kolay pins an older copy. `ember-vite`'s typecheck still passes.
- **Harness decorators.** `@harnessed-ts/core/babel` goes first in
  `babel.config.mjs`, the same as `test-apps/ember-vite`. Harness files must be named
  `*.harness.ts` or live under `harness(es)/`. For types, harnesses get their own
  TS project (`tests/harness/tsconfig.json`), referenced from the app's.
- **React island.** `app/modifiers/react-island.ts` (an `ember-modifier` with
  `createRoot` + `flushSync`) mounts `.tsx` components, and Vite compiles them with no
  extra Babel. A plain function modifier does **not** work in Ember 7 (no default
  modifier manager). `.tsx` files get their own TS project with `jsx: react-jsx`,
  and the app's tsconfig also needs `jsx` set before it accepts the reference.
- **Proof.** The same `GreeterHarness` drives an Ember component and the
  React component through `@harnessed-ts/dom`
  (`tests/integration/{harness-in-ember,react-island}-test.gts`). This is the
  mechanism behind the framework toggle and the Run button.
- **Lint.** Root ESLint ignores `docs-app/**`, the same as `test-apps/**`. When the
  real pages test is written, it should use a harness (a `GuidePage` harness)
  rather than raw `find`/`assert.dom`, because `harnessed/no-raw-locator-in-test`
  flags the Formwright original.
