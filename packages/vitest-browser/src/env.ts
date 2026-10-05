import type { EnvConfig } from '@harnessed-ts/core'
import { VITEST_BROWSER_DRIVER } from './driver-id'
// Imported for its side effect: constructing an env is the moment the driver has
// to be in the registry, and a bare re-export could be tree-shaken away.
import './vitest-browser-query'

export { VITEST_BROWSER_DRIVER }

export interface VitestBrowserEnv extends EnvConfig {
  readonly driver: typeof VITEST_BROWSER_DRIVER
  /**
   * Where queries start. Defaults to `document.body`, which is where a portal
   * lands — scope it to a render's `container` only when the tree has none.
   */
  readonly container: HTMLElement
}

export interface VitestBrowserEnvOptions {
  container?: HTMLElement
}

/** Builds the env a harness is constructed with under Vitest browser mode. */
export function vitestBrowser({ container }: VitestBrowserEnvOptions = {}): VitestBrowserEnv {
  return {
    driver: VITEST_BROWSER_DRIVER,
    container: container ?? document.body,
  }
}
