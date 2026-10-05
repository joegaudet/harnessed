# test-apps

Private workspace apps, one per driver and runner, each running the
`@harnessed-ts/conformance` catalog unchanged. They exist because some runners
need an application around them — an Ember app for ember-qunit, a Cypress
project, a WebdriverIO config — that has no place inside a published package.

Each app:

- is named `test-app-<name>`, outside the `@harnessed-ts/` scope that changesets
  versions as one group, and is `private`;
- brings its own tooling (TypeScript project, bundler); the root lint and
  typecheck do not reach into `test-apps/`;
- depends on `@harnessed-ts/conformance` (built) and the driver under test;
- registers every entry of `specs`, `pageSpecs` and, if its driver can navigate,
  `urlSpecs` with its runner — no opt-outs;
- serves or mounts the fixture itself. A browser driver points at the React
  fixture served by `pnpm --filter conformance serve:fixture`, with a
  `FIXTURE_PORT` of its own so runners can work side by side;
- has a `test` script, and a `.github/workflows/conformance-<name>.yml` that
  calls the reusable `conformance-driver.yml`.
