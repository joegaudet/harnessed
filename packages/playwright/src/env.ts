import type { EnvConfig } from '@harnessed-ts/core'
import type { Page } from '@playwright/test'
import { PLAYWRIGHT_DRIVER } from './driver-id'
// Side effect: constructing an env is the moment the driver has to be registered.
import './playwright-query'

export { PLAYWRIGHT_DRIVER }

export interface PlaywrightEnv extends EnvConfig {
  readonly driver: typeof PLAYWRIGHT_DRIVER
  readonly page: Page
}

/** Builds the env a harness is constructed with under Playwright. */
export function pw(page: Page): PlaywrightEnv {
  return { driver: PLAYWRIGHT_DRIVER, page }
}
