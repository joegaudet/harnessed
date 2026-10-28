import type { View } from '@harnessed-ts/conformance'
import { viewSearch } from '@harnessed-ts/conformance'
import { nightwatch } from '@harnessed-ts/nightwatch'
import type { NightwatchEnv } from '@harnessed-ts/nightwatch'

const STAGE = 'return document.querySelector(\'[data-testid="stage"]\') !== null'

/**
 * Waits for the fixture's stage — the readiness signal both reference runners
 * wait on — polling every 10ms: the catalog's late nodes arrive 150ms after the
 * stage, so a slower poll would hand a spec a page where they are already
 * rendered.
 */
export async function waitForStage(): Promise<void> {
  const deadline = Date.now() + 10_000
  while ((await browser.driver.executeScript(STAGE)) !== true) {
    if (Date.now() > deadline) throw new Error('the fixture never rendered its stage')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

/** Opens a fixture view and builds the env for it, once its stage is up. */
export async function show(view: View): Promise<NightwatchEnv> {
  await browser.navigateTo(`/${viewSearch(view)}`)
  await waitForStage()
  return nightwatch(browser)
}
