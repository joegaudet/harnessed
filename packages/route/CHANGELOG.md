# @harnessed-ts/route

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

### Patch Changes

- Updated dependencies
  - @harnessed-ts/core@0.2.0

## 0.1.0

First release.

`RouteHarness<Params>` — one test object per URL. Path params are declared, so
`goto()` is checked against the path; substitution is URL-encoded and applies at
every occurrence; `waitForReady()` is required and runs after every navigation.

Runs on the driver's navigation capability, so it depends only on
`@harnessed-ts/core` and works against any driver that can drive an address bar.
