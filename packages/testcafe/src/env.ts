/// <reference types="testcafe" />
import type { EnvConfig } from '@harnessed-ts/core'
import { TESTCAFE_DRIVER } from './driver-id'
import { assertOwnController } from './session'
// Side effect: constructing an env is the moment the driver has to be registered.
import './testcafe-query'

export { TESTCAFE_DRIVER }

export interface TestCafeEnv extends EnvConfig {
  readonly driver: typeof TESTCAFE_DRIVER
  /** The test's controller. Every action goes through it, so an env is per test. */
  readonly t: TestController
  /**
   * What a page's relative path resolves against in `goto()`. Without it, the
   * page the test is on — which is the fixture's page when a test starts.
   */
  readonly baseUrl?: string
}

export interface TestCafeEnvOptions {
  baseUrl?: string
}

/**
 * Builds the env a harness is constructed with under TestCafe. `t` is the one
 * the test function is handed — not the shared `t` exported by 'testcafe',
 * which belongs to no one test.
 */
export function testcafe(t: TestController, options: TestCafeEnvOptions = {}): TestCafeEnv {
  assertOwnController(t)
  return options.baseUrl === undefined
    ? { driver: TESTCAFE_DRIVER, t }
    : { driver: TESTCAFE_DRIVER, t, baseUrl: options.baseUrl }
}
