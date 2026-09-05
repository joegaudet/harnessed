# @harnessed/core

## 0.2.0

### Minor Changes

- ffadd53: First release.

  One page-object API that runs under both Testing Library and Playwright: write a
  harness once, use it in a fast jsdom unit test and in a real browser.

  - `@harnessed/core` — `Query`, `Selector` builders, `ComponentHarness`, the
    `@Harness` / `@ByRole` / `@ChildHarness` decorators, a driver registry that keeps
    core free of any driver dependency, `configure()`, runner-agnostic matcher
    implementations, and a Vite plugin that lowers standard decorators.
  - `@harnessed/dom` — Testing Library driver. Queries the DOM, so no React
    dependency; takes an optional `container` to scope a harness to one tree.
  - `@harnessed/playwright` — Playwright driver, plus `createApiStubs` for running a
    browser suite with no backend and `withWorld` for scenario-scoped BDD state.
  - `@harnessed/route` — `RouteHarness<Params>`: one test object per URL, with
    params checked against the path, URL-encoded substitution at every occurrence,
    and a required readiness check.
  - `@harnessed/eslint-plugin` — five rules making the authoring conventions a gate.
  - `@harnessed/claude` — installs the authoring skill and rules for coding agents,
    generating the file-placement table from the repo's own layout.
  - `@harnessed/config` — loads `harnessed.config.ts`, so the linter and the docs
    generator read the layout a repo declares once.
  - `@harnessed/conformance` — the certification suite itself, published so a driver
    written outside this repo can prove it agrees with the others.

  Five cross-driver guarantees are each backed by a spec that runs unchanged under
  both drivers, so a disagreement between them fails the build.
