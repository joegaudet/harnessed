import type { EnvConfig } from '@harnessed-ts/core'
import { EMBER_DRIVER } from './driver-id'
// Imported for their side effects: constructing an env is the moment the driver
// has to be in the registry, and a bare re-export could be tree-shaken away.
import './ember-query'
import './navigation'

export { EMBER_DRIVER }

export interface EmberEnv extends EnvConfig {
  readonly driver: typeof EMBER_DRIVER
  /**
   * Where queries start, scoped and `{ global: true }` alike. Defaults to the
   * test's root element (`#ember-testing`), read at query time so one env serves
   * a whole test. Not `document.body`: the test page also holds QUnit's own
   * report, whose test names would make text and role queries ambiguous.
   */
  readonly root: Element | undefined
}

export interface EmberEnvOptions {
  root?: Element
}

/**
 * Builds the env a harness is constructed with in an Ember rendering or
 * application test:
 *
 * ```ts
 * await render(<template><LoginForm /></template>)
 * const form = new LoginFormHarness(ember())
 * ```
 */
export function ember({ root }: EmberEnvOptions = {}): EmberEnv {
  return { driver: EMBER_DRIVER, root }
}
