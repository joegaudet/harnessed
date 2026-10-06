import type { EnvConfig } from '@harnessed-ts/core'
import { WEBDRIVERIO_DRIVER } from './driver-id'
// Side effect: constructing an env is the moment the driver has to be registered.
import './webdriverio-query'

export { WEBDRIVERIO_DRIVER }

export interface WebdriverioEnv extends EnvConfig {
  readonly driver: typeof WEBDRIVERIO_DRIVER
  /** The WebdriverIO `browser` — the testrunner's global, or a `remote()` session. */
  readonly browser: WebdriverIO.Browser
}

/** Builds the env a harness is constructed with under WebdriverIO. */
export function wdio(browser: WebdriverIO.Browser): WebdriverioEnv {
  return { driver: WEBDRIVERIO_DRIVER, browser }
}
