import type { EnvConfig } from '@harnessed-ts/core'
import type { NightwatchAPI } from 'nightwatch'
import { NIGHTWATCH_DRIVER } from './driver-id'
// Side effect: constructing an env is the moment the driver has to be registered,
// and a bare re-export could be tree-shaken away.
import './nightwatch-query'

export { NIGHTWATCH_DRIVER }

export interface NightwatchEnv extends EnvConfig {
  readonly driver: typeof NIGHTWATCH_DRIVER
  /** Nightwatch's `browser`: the test's argument, or the global. */
  readonly browser: NightwatchAPI
}

/** Builds the env a harness is constructed with under Nightwatch. */
export function nightwatch(browser: NightwatchAPI): NightwatchEnv {
  return { driver: NIGHTWATCH_DRIVER, browser }
}
