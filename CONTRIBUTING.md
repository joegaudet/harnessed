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
pnpm typecheck        # tsc --build across every package
pnpm build
pnpm test             # rule tests, then both conformance drivers
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

The specs live in `specs/catalog.ts` as plain async functions using
`node:assert/strict`, because one file cannot use both Vitest's `it` and
Playwright's `test`. Two thin runners enumerate the catalog and register each entry
with their own runner.

**A behaviour change belongs in the catalog, not in a per-driver test.** That is
what stops the drivers drifting apart — which is the failure this library exists to
prevent, and the reason its ancestors accumulated three divergence fixes.

Route behaviour has no jsdom counterpart and lives in `specs/routes.catalog.ts`.
Matcher registration is runner-specific, so those specs are per-driver too. Both
exceptions are deliberate; anything else should be shared.

There is no coverage threshold. A percentage would not catch two drivers disagreeing,
which is the only bug class that matters here.

## Adding a guarantee

1. Add a spec to `specs/catalog.ts` describing the behaviour.
2. Run both drivers. Expect at least one to fail.
3. Make them agree.
4. Add it to the **Cross-driver guarantees** list in the README.

## Releasing

Once per repository, configure what a release needs:

```bash
bash scripts/setup-release.sh            # or --dry-run first
```

It stores the `NPM_TOKEN` secret (read silently, never echoed or passed as an
argument) and allows Actions to create pull requests. Both have already stopped a
release here: the first attempt failed opening the changesets version PR and never
reached npm at all.

After that, releases are automatic. Merging to `main` with changesets pending
opens a "Version Packages" PR; merging _that_ publishes. With none pending, the
merge publishes the current versions directly.

## Changesets

Every change that affects a published package needs one:

```bash
npx changeset
```

The packages version in lockstep, so pick the same bump for all of them. Releases
publish from CI with provenance on merge of the version PR — never from a laptop.

## Style

Prettier and ESLint, both gated. The plugin lints itself: if you add a rule, it
runs over this repo too. Rule changes need `RuleTester` cases in
`packages/eslint-plugin/tests/` — an untested lint rule that crashes takes a
consumer's whole build down with it.
