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
  fixture served by `pnpm --filter conformance serve:fixture`, or at its Ember
  port built and served by `pnpm --filter test-app-ember-vite serve:fixture`,
  with a `FIXTURE_PORT` of its own so runners can work side by side;
- has a `test` script, and a `.github/workflows/conformance-<name>.yml` that
  calls the reusable `conformance-driver.yml`.

`vue`, `solid` and `svelte` are ports of the fixture, as `ember-vite` is the
Glimmer one. Each holds itself to the React original with `fixtureParity` from
`@harnessed-ts/conformance`, runs the catalog under the dom driver (`test`) and
the vitest-browser driver (`test:browser`), and builds and serves itself with
`FIXTURE_PORT=<port> pnpm --filter test-app-<framework> serve:fixture` (5191,
5192 and 5193 by default). `playwright-frameworks` runs the Playwright reference
specs against all three, one project and web server per port (`FRAMEWORK=vue`
picks one), and `cypress-ct-frameworks` mounts the Vue and Svelte ports as
Cypress component tests (`CYPRESS_FRAMEWORK=vue|svelte`). Solid's `<Portal>`
mounts into a wrapper `<div>` under `body`, so its dialog is
`body > div > [role=dialog]`; nothing in the catalog depends on that.

`demos` is the one app that is not a conformance run. It holds the README's
GIFs: one demo flow, written once against the fixture's harnesses, run under
React Testing Library, Playwright and Cypress against the React fixture and the
Ember app in `ember-vite`. Its `test` runs that flow under all five without
recording (`.github/workflows/demos.yml`); `record` re-records the GIFs into
`docs/media/`.
