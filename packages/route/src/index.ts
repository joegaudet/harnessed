/**
 * A shim for one release. `RouteHarness` became `PageHarness`: a route is a page
 * with a `path`. Import `PageHarness` from `@harnessed-ts/page`; this package is
 * removed in the next minor.
 */
export {
  /** @deprecated Use `PageHarness` from `@harnessed-ts/page`. Removed in the next minor. */
  PageHarness as RouteHarness,
} from '@harnessed-ts/page'
export type { GotoArgs } from '@harnessed-ts/page'
