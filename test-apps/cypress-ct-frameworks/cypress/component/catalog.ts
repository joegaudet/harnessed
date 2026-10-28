import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { timeoutFor } from '@harnessed-ts/core'
import type { CypressEnv, HarnessCommandOptions } from '@harnessed-ts/cypress'

/** Resolves once `ready()` holds, polling; rejects after the default timeout. */
async function until(ready: () => boolean, failure: string): Promise<void> {
  const deadline = Date.now() + timeoutFor()
  while (!ready()) {
    if (Date.now() > deadline) throw new Error(failure)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

/**
 * How a framework's spec puts its fixture on screen. A spec picks its view from
 * inside the bridge's promise, where `mount` cannot be enqueued — so a Stage
 * component is mounted empty, and `show()` tells it to render the fixture once
 * the view is known.
 */
export interface Stage {
  /** Enqueues the framework's `mount` of its Stage component. */
  mount(): void
  /**
   * Set by the mounted Stage, unset when it unmounts: renders the fixture
   * afresh under `key`, and resolves once the framework has flushed that render.
   */
  render?: ((key: number) => Promise<void>) | undefined
}

let renders = 0

function context(env: CypressEnv, stage: Stage): ConformanceCtx {
  return {
    async show(view: View) {
      // The framework mounts after the `mount` command has already moved on.
      await until(() => stage.render !== undefined, 'mount never mounted the stage')
      // The fixture reads its view from the URL, like the dom runner's. In
      // component testing that is the spec frame's own, so only the query string
      // changes; the path is Cypress's.
      window.history.replaceState({}, '', `${window.location.pathname}${viewSearch(view)}`)
      await stage.render?.(++renders)
      const { document } = env
      await until(
        () => document.querySelector('[data-testid="stage"]') !== null,
        'the fixture never rendered its stage',
      )
      return env
    },
  }
}

function registerOnce(stage: Stage, options: HarnessCommandOptions): void {
  const specFrameUrl = window.location.href
  afterEach(() => {
    window.history.replaceState({}, '', specFrameUrl)
  })
  for (const spec of specs) {
    it(spec.name, () => {
      stage.mount()
      cy.harnessEnv(env => spec.run(context(env, stage)), options)
    })
  }
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, () => {
      stage.mount()
      cy.harnessEnv(env => spec.run(context(env, stage)), options)
    })
  }
}

/**
 * The component catalog for one framework's port, as test-apps/cypress-ct runs
 * it for the React fixture. No urlSpecs: a component test has no address bar of
 * its own to drive — the spec frame is the page — so goto() refuses by design.
 */
export function registerCatalog(framework: string, stage: Stage): void {
  describe(`conformance: cypress driver (component, ${framework})`, () => {
    registerOnce(stage, {})
  })

  // The catalog again with trusted CDP input, wherever CDP exists.
  if (Cypress.isBrowser({ family: 'chromium' })) {
    describe(`conformance: cypress driver (component, ${framework}, realEvents)`, () => {
      registerOnce(stage, { realEvents: true })
    })
  }
}
