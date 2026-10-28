import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { nightwatch } from '@harnessed-ts/nightwatch'
import type { NightwatchEnv } from '@harnessed-ts/nightwatch'

declare module 'nightwatch' {
  interface NightwatchCustomCommands {
    /** @nightwatch/react's and @nightwatch/vue's mount: a component file, by its Vite path. */
    mountComponent(path: string, props?: Record<string, unknown>): Awaitable<this, unknown>
  }
}

const POLL_MS = 10
const READY_MS = 10_000

/** Polls a script until it answers true. */
async function until(script: string, failure: string): Promise<void> {
  const deadline = Date.now() + READY_MS
  while ((await browser.driver.executeScript(script)) !== true) {
    if (Date.now() > deadline) throw new Error(failure)
    await new Promise(resolve => setTimeout(resolve, POLL_MS))
  }
}

/**
 * The context the catalog runs with: each `show()` mounts the framework's stage
 * component through the plugin, a fresh renderer page each time, then has it
 * render the fixture for the view (`window.__harnessedShow`, which every
 * framework's stage provides) and waits for the fixture's stage.
 */
function componentContext(stagePath: string): ConformanceCtx {
  return {
    async show(view: View): Promise<NightwatchEnv> {
      const mounted = await browser.mountComponent(stagePath)
      // The plugin hands back its failure rather than throwing it.
      if (mounted instanceof Error) throw mounted
      await until(
        'return typeof window.__harnessedShow === "function"',
        `${stagePath} mounted, but never offered window.__harnessedShow`,
      )
      await browser.driver.executeScript('window.__harnessedShow(arguments[0])', viewSearch(view))
      await until(
        'return document.querySelector(\'[data-testid="stage"]\') !== null',
        'the fixture never rendered its stage',
      )
      return nightwatch(browser)
    },
  }
}

/**
 * Registers the component catalog — `specs` and `pageSpecs` — for one
 * framework's stage. No `urlSpecs`: a component test has no address bar of its
 * own to drive, so they belong to the e2e run (test-apps/nightwatch).
 */
export function registerCatalog(framework: string, stagePath: string): void {
  describe(`conformance: nightwatch driver (component, ${framework})`, function () {
    for (const spec of specs) {
      it(spec.name, async function () {
        await spec.run(componentContext(stagePath))
      })
    }
    for (const spec of pageSpecs) {
      it(`page: ${spec.name}`, async function () {
        await spec.run(componentContext(stagePath))
      })
    }
  })
}
