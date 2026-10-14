# GitHub Pages homepage

A single landing page at `https://joegaudet.com/harnessed/` that shows what
harnessed is, every supported runner, and the main use cases, with embedded live
examples.

## Decisions

| Topic         | Choice                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Styling       | Pico.css (classless) from a CDN; semantic HTML, no custom design system |
| Scope         | One page; deep docs stay in the README and package READMEs              |
| Source/deploy | `docs/site/` on `main`, deployed by a GitHub Actions Pages workflow     |
| Runner data   | Hand-written HTML                                                       |
| Highlighting  | Prism.js from a CDN (TypeScript + Gherkin grammars)                     |
| Live examples | Embedded StackBlitz iframes, jsdom only                                 |
| Media         | Reuse `docs/media/*.gif`; link to the README for full docs              |

## Layout

```
docs/site/
  index.html          # the whole page
  site.css            # small overrides on top of Pico (grid, badge row), if needed
examples/
  vitest-dom/         # standalone StackBlitz project (see "Live examples")
  page-and-route/     # optional second project
.github/workflows/pages.yml
```

The Pages workflow copies `docs/media/` into the artifact next to
`docs/site/`, so the GIFs stay in one place.

## Page sections

1. **Header and hero.** The name, a one-line pitch that matches the repo
   description, a `pnpm add` command, and links to GitHub and npm.
2. **What a harness is.** The `LoginFormHarness` example from the README, then
   the same harness used in a Testing Library test and in a Playwright test,
   side by side.
3. **Write once, run everywhere.** A row of the five demo GIFs (RTL, Playwright,
   Cypress, each against React and Ember) from `docs/media/`.
4. **Try it live.** An embedded StackBlitz iframe running `examples/vitest-dom`.
   Load it on click behind a poster button, so WebContainers don't boot on page
   load.
5. **Supported runners.** A table with one row per runner:
   | Runner | Package | Environment | Install | CI |
   - Testing Library / jsdom, `@harnessed-ts/dom`
   - Playwright, `@harnessed-ts/playwright`
   - Cypress (CT and E2E), `@harnessed-ts/cypress`
   - WebdriverIO, `@harnessed-ts/webdriverio`
   - Vitest browser mode, `@harnessed-ts/vitest-browser`
   - Puppeteer, `@harnessed-ts/puppeteer`
   - TestCafe, `@harnessed-ts/testcafe`
   - Ember (QUnit, Vitest, exam), `@harnessed-ts/ember`

   The CI cell is that runner's `conformance-*.yml` badge. Below the table, one
   `<details>` per runner holds a short setup snippet taken from that package's
   README.

6. **Use cases.** One `<article>` each, with a short code sample:
   - Unit-to-E2E reuse: the same harness in jsdom and a real browser.
   - Page objects and routing: `@harnessed-ts/page` and `@harnessed-ts/route`.
   - BDD / Gherkin: a `.feature` file plus a step definition driving a harness
     (Cucumber, playwright-bdd, Cypress).
   - Tooling: `@harnessed-ts/eslint-plugin`, `chai`/`qunit` assertions,
     `@harnessed-ts/config`, and the `@harnessed-ts/claude` skill installer.
7. **Footer.** License, contributors, links to the README and CONTRIBUTING.

## Live examples

StackBlitz runs Node in the browser (WebContainers). Vitest with jsdom and
Testing Library run there. Playwright, Cypress, WebdriverIO, Puppeteer and
TestCafe need a real browser binary and do not, so those runners show code only.

`examples/vitest-dom/` is a standalone project, outside the pnpm workspace:

- It depends on the **published** `@harnessed-ts/*` versions, not `workspace:*`,
  because StackBlitz installs from npm.
- It contains a tiny React component, its harness, and a passing Vitest spec, with
  `vitest --watch` as the start command so the iframe shows green tests.
- The embed URL is
  `https://stackblitz.com/github/joegaudet/harnessed/tree/main/examples/vitest-dom?embed=1&file=src/LoginForm.test.tsx&view=both`.

Add `examples/` to `pnpm-workspace.yaml`'s exclusions, and add one CI job that
runs `npm ci && npx vitest run` inside each example, so the embeds can't rot.
That follows the same reasoning as `demos.yml`.

## Deploy

`.github/workflows/pages.yml`:

- Triggers on pushes to `main` that touch `docs/site/**`, `docs/media/**` or
  `examples/**`, plus `workflow_dispatch`.
- Steps: `actions/configure-pages`, then assemble `_site/` from `docs/site` and
  `docs/media`, then `actions/upload-pages-artifact`, then `actions/deploy-pages`.
- Permissions: `pages: write`, `id-token: write`.
- One-time manual step: in repo Settings, under Pages, set Source to "GitHub
  Actions". Then set the repo homepage URL to the Pages URL with
  `gh repo edit --homepage`.

## Verification

- Open `docs/site/index.html` locally, checking light and dark mode and a 375px
  width (no horizontal scroll; the table scrolls inside its container).
- Run the examples CI job green.
- After the first deploy, check that every badge, GIF, npm link and the StackBlitz
  embed load from the Pages URL.

## Tasks

1. Add `examples/vitest-dom` and its CI job (test first: the spec must pass
   against the published packages).
2. Write `docs/site/index.html`, sections 1–7.
3. Add `pages.yml`, enable Pages, and set the homepage URL.
4. Add a "Website" link to the README.

## Risks and open items

- **npm may be behind the repo.** npm and every `packages/*/package.json` say
  0.3.0, but the latest commit is titled "release: 0.4.0". Check what actually
  shipped. Examples pinned to 0.3.0 could show an API that differs from the
  page (e.g. the `waitFor(state)` change in #42). Publish 0.4.0 before the
  examples go live, or pin them and accept the gap.
- **Decorators.** Harnesses use TC39 `accessor` decorators. The example's Vite
  and esbuild config must handle them inside StackBlitz. Check this first; it
  decides whether the live demo is viable.
- **Hand-written matrix drift.** Adding a runner means editing the HTML.
  Accepted for about 8 rows.
