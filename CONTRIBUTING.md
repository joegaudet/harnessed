# Contributing

## Setup

```bash
pnpm install
pnpm build                       # tsc emits .d.ts, tsup emits the JS
npx playwright install chromium  # for the browser half of the conformance suite
```

Node ≥ 22.12 and pnpm. The packages resolve to each other through the workspace,
so a change in `core` is visible to the drivers without republishing — but the
conformance suite imports the **built** output, so run `pnpm build` after editing a
package before running the suites.

## The gate

```bash
pnpm lint
pnpm format:check
pnpm typecheck        # tsc --build across every package, then tests + tooling
pnpm build
pnpm test             # rule tests, package unit tests, then both conformance drivers
```

**Before pushing, run the whole thing against a clean clone:**

```bash
bash scripts/verify-like-ci.sh          # every job, ~3 min
bash scripts/verify-like-ci.sh --quick  # skips the browser and TS matrix
```

This exists because a passing local run is weaker evidence than it looks. Your
working tree has a `dist/` from the last build, browsers already installed, and
whatever directory you happen to be in; CI has none of that. Two failures reached
CI that way — a job that never built the package it imported, and an install
command that only resolved from inside a subdirectory. Both reproduce instantly
against a fresh clone and not at all against a warm tree.

Keep the job list in `scripts/verify-like-ci.sh` in step with
`.github/workflows/ci.yml`.

## How this is tested

`packages/conformance` holds one neutral fixture app and **one** set of behavioural
specs, executed twice:

```bash
pnpm test:dom          # @harnessed-ts/dom, under Vitest + jsdom
pnpm test:playwright   # @harnessed-ts/playwright, against the fixture served by Vite
```

The specs live in `specs/catalog.ts` as plain async functions, because one file
cannot use both Vitest's `it` and Playwright's `test`. Thin runners enumerate the
catalog and register each entry with their own runner. They assert through
`specs/assert.ts` rather than `node:assert`: some runners execute the specs inside
a browser, where Node's modules do not exist.

**A behaviour change belongs in the catalog, not in a per-driver test.** That is
what stops the drivers drifting apart — which is the failure this library exists to
prevent, and the reason its ancestors accumulated three divergence fixes.

Page behaviour lives in `specs/pages.catalog.ts`: `pageSpecs` run under every
driver, and `urlSpecs` — `goto()` and the URL after it — only under a driver that
can navigate. Matcher registration is runner-specific, so those specs are
per-driver too. Both exceptions are deliberate; anything else should be shared.

There is no coverage threshold. A percentage would not catch two drivers disagreeing,
which is the only bug class that matters here.

## Adding a driver's conformance run

Drivers beyond the two reference ones run the catalog from an app under
`test-apps/` — see [`test-apps/README.md`](test-apps/README.md). Give the app a
`test` script and add a caller workflow next to the others:

```yaml
# .github/workflows/conformance-<name>.yml
name: conformance-<name>
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: conformance-<name>-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
jobs:
  run:
    uses: ./.github/workflows/conformance-driver.yml
    with:
      name: <name>
      setup: pnpm --filter <app> exec <install browsers>
      test: pnpm --filter <app> test
```

The check reports as `run / conformance/<name>` — that is the string to mark as
required. Name the app outside the `@harnessed-ts/` scope (`test-app-<name>`):
changesets versions that scope as one fixed group.

A browser driver serves the React fixture with
`FIXTURE_PORT=<port> pnpm --filter conformance serve:fixture`, or the Ember port
of it with `FIXTURE_PORT=<port> pnpm --filter test-app-ember-vite serve:fixture`
(which builds the app first; concurrent runs take turns building). The Vue,
Solid, Svelte and Angular ports serve the same way from `test-app-vue`,
`test-app-solid`, `test-app-svelte` and `test-app-angular`. Pick a port no other
runner uses, so they can run side by side locally.

## Porting the fixture to another framework

A UI framework is supported when a port of the fixture runs the catalog. The
port lives in `test-apps/<framework>`, renders every view the way
`fixture/App.tsx` does (`?view=` and the pathname), and holds itself to the
React original with `fixtureParity()` from `@harnessed-ts/conformance`, which
names the first element, attribute or text where its markup parts from
`fixture/trees.json`. Then run the catalog against it under at least one
in-process driver and add it to `test-apps/playwright-frameworks`.

## Adding a guarantee

1. Add a spec to `specs/catalog.ts` describing the behaviour.
2. Run both drivers. Expect at least one to fail.
3. Make them agree.
4. Add it to the **Cross-driver guarantees** list in the README.

## The website

[joegaudet.com/harnessed](https://joegaudet.com/harnessed/) is built from
`docs/site/`: one hand-written `index.html` and `site.css` on Pico.css, no build
step. `.github/workflows/pages.yml` deploys it on every push to `main` that
touches `docs/site/` or `docs/media/`.

Nothing generates it from the code, so **a PR that changes anything the site
shows updates the site in the same PR**:

- **A runner, driver or UI framework is added, removed, or gains or loses
  conformance:** the hero illustration (solid border means it runs the
  conformance catalog in CI, dashed means not yet), the runner table and its
  badge, and the setup `<details>` for that runner.
- **A public API used in a snippet changes** (`Query`, `ComponentHarness`,
  `PageHarness`, a driver's env factory, matchers, Gherkin helpers): every
  snippet on the page that uses it. Search `docs/site/index.html` for the name.
- **A package is added, renamed or deprecated:** the use cases and tooling list.
- **The demo GIFs are re-recorded:** nothing to do; the page reads `docs/media/`.
- **`examples/vitest-dom` drifts from the published API:** bump its
  `@harnessed-ts/*` versions after a release. The `examples` CI job keeps it
  green, and the site's StackBlitz link opens it from `main`.

To preview:

```bash
mkdir -p /tmp/harnessed-site/media && cp -R docs/site/. /tmp/harnessed-site/ && cp docs/media/*.gif /tmp/harnessed-site/media/ && python3 -m http.server 8765 --directory /tmp/harnessed-site
```

## Releasing

A release is cut by pushing a tag. Nothing publishes on merge.

1. PRs that change a published package carry a changeset (`pnpm changeset`). While any are
   pending on `main`, CI keeps a "chore: version packages" PR open with the next version and
   the changelogs.
2. Merge that PR.
3. Tag the merge commit with the new version and push the tag:

   ```bash
   git switch main && git pull
   git tag -a v1.2.3 -m v1.2.3
   git push origin v1.2.3
   ```

`release.yml` checks that the tag is on `main` and matches every public package's version,
publishes whatever is not already on npm through `scripts/publish.mjs` (OIDC trusted publishing
with provenance; there is no `NPM_TOKEN`), then creates the GitHub release. If a run fails, re-run
it: it skips what is already published.

**A brand-new package** cannot publish through OIDC: npm only configures a trusted publisher for
a name that already exists. Its first release goes out once through `bootstrap-publish.yml` with
a short-lived token (restore that file from git history if it has been deleted; its header has
the steps). After that, set `joegaudet/harnessed` / `release.yml` as the package's trusted
publisher on npmjs.com.

The version PR is opened by a GitHub App, not `GITHUB_TOKEN`: GitHub runs no workflows for
pushes made with `GITHUB_TOKEN`, so the PR would never get its required checks. One App serves
every repository that uses this workflow. To set it up:

1. Create a GitHub App (Settings → Developer settings → GitHub Apps → New) with webhooks off and
   repository permissions **Contents: read and write** and **Pull requests: read and write**.
2. Install it on this repository.
3. Generate a private key, then in this repository (Settings → Secrets and variables → Actions)
   add the variable `RELEASE_APP_CLIENT_ID` (the App's client ID) and the secret
   `RELEASE_APP_PRIVATE_KEY` (the whole `.pem` file).

## Changesets

Every change that affects a published package needs one:

```bash
npx changeset
```

The packages version in lockstep, so pick the same bump for all of them. Releases
publish from CI with provenance when a tag is pushed — never from a laptop.

## Style

Prettier and ESLint, both gated. The plugin lints itself: if you add a rule, it
runs over this repo too. Rule changes need `RuleTester` cases in
`packages/eslint-plugin/tests/` — an untested lint rule that crashes takes a
consumer's whole build down with it.
