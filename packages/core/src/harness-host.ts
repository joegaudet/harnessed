import type { EnvConfig } from './env'
import type { Selector } from './selector'

/**
 * What a decorator needs from the object it is attached to. Satisfied by both
 * `ComponentHarness` and `RouteHarness`, which is why one set of decorators works
 * on both.
 */
export interface HarnessHost {
  /** @internal Not part of the public API; excluded from semver. */
  _env: EnvConfig
  /** @internal Not part of the public API; excluded from semver. */
  _scope: Selector[]
}
