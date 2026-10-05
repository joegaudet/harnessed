import type { View } from '@harnessed-ts/conformance'
import { viewSearch } from '@harnessed-ts/conformance'
import { wdio } from '@harnessed-ts/webdriverio'
import type { WebdriverioEnv } from '@harnessed-ts/webdriverio'
import { browser } from '@wdio/globals'

/**
 * Waits for the fixture's stage — the readiness signal both reference runners
 * wait on. It polls through the classic Execute Script endpoint, a few
 * milliseconds a call even in a BiDi session, and every 10ms: the catalog's
 * late nodes arrive 150ms after the stage, so a slower poll would hand a spec a
 * page where they are already rendered.
 */
export async function waitForStage(): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await browser.executeScript(
        'return document.querySelector(\'[data-testid="stage"]\') !== null',
        [],
      )) === true,
    { interval: 10 },
  )
}

/** Opens a fixture view and builds the env for it, once its stage is up. */
export async function show(view: View): Promise<WebdriverioEnv> {
  await browser.url(`/${viewSearch(view)}`)
  await waitForStage()
  return wdio(browser)
}
