# @harnessed-ts/core

## 0.2.0

### Minor Changes

- The packages publish under the `@harnessed-ts` scope. Nothing shipped under the
  previous `@harnessed` scope, so there is no migration to perform.

## 0.1.0

First release.

The driver-free core: `Query`, the `Selector` builders, `ComponentHarness` and the
shared `ScopedHarness`, the `@Harness` / `@ByRole` / `@ChildHarness` decorators, the
driver registry, `configure()` / `applyConfig()`, runner-agnostic matcher
implementations, and the Vite plugin that lowers standard decorators.

Depends on no driver: drivers register themselves against a registry keyed on
`globalThis`, which is also what keeps a dual ESM/CJS install from ending up with
two of everything. Navigation is an optional capability a driver can register, so
`@harnessed-ts/route` works against anything that can drive a URL.
