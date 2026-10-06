import { pageSpecs, specs, urlSpecs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { navigationFor, timeoutFor } from '@harnessed-ts/core'
import type { CypressEnv, HarnessCommandOptions } from '@harnessed-ts/cypress'

/**
 * Resolves once the fixture has rendered its stage into the AUT document. The
 * demos app (test-apps/demos) waits on it too.
 */
export async function stageRendered(env: CypressEnv): Promise<void> {
  const deadline = Date.now() + timeoutFor()
  while (env.document.querySelector('[data-testid="stage"]') === null) {
    if (Date.now() > deadline) throw new Error('the fixture never rendered its stage')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

/**
 * A view is reached the way a page's goto() reaches a URL — inside the bridge's
 * promise, through the driver's own navigation — so every spec runs as one
 * `cy.harnessEnv` with nothing enqueued around it.
 */
function context(env: CypressEnv): ConformanceCtx {
  return {
    async show(view: View) {
      await navigationFor(env).goto(env, `/${viewSearch(view)}`)
      await stageRendered(env)
      return env
    },
  }
}

function registerCatalog(options: HarnessCommandOptions): void {
  for (const spec of specs) {
    it(spec.name, () => {
      cy.harnessEnv(env => spec.run(context(env)), options)
    })
  }
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, () => {
      cy.harnessEnv(env => spec.run(context(env)), options)
    })
  }
  for (const spec of urlSpecs) {
    it(`url: ${spec.name}`, () => {
      cy.harnessEnv(env => spec.run({ env }), options)
    })
  }
}

/**
 * The whole catalog, as e2e specs against whichever fixture the project's
 * baseUrl serves: the React original here, the Ember port in test-app-cypress-ember.
 * `app` names it in the suite titles.
 */
export function describeConformance(app: string): void {
  describe(`conformance: cypress driver (e2e, ${app})`, () => {
    registerCatalog({})
  })

  // The whole catalog again with trusted CDP input, wherever CDP exists. The
  // default run above is the one every browser must pass; this one proves the
  // opt-in agrees with it.
  if (Cypress.isBrowser({ family: 'chromium' })) {
    describe(`conformance: cypress driver (e2e, ${app}, realEvents)`, () => {
      registerCatalog({ realEvents: true })
    })
  }
}
