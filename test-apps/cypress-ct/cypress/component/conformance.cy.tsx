import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { App } from '@harnessed-ts/conformance/fixture'
import { timeoutFor } from '@harnessed-ts/core'
import type { CypressEnv, HarnessCommandOptions } from '@harnessed-ts/cypress'
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

/** Resolves once `ready()` holds, polling; rejects after the default timeout. */
async function until(ready: () => boolean, failure: string): Promise<void> {
  const deadline = Date.now() + timeoutFor()
  while (!ready()) {
    if (Date.now() > deadline) throw new Error(failure)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

/** The mounted Stage's way to render the fixture; unset whenever none is mounted. */
let renderApp: ((key: number) => void) | undefined
let renders = 0

/**
 * What `cy.mount` mounts. A spec picks its view from inside the bridge's
 * promise, where `cy.mount` cannot be enqueued — so the mounted component waits,
 * and `show()` tells it to render the fixture once the view is known.
 */
function Stage() {
  const [key, setKey] = useState<number | null>(null)
  useEffect(() => {
    renderApp = setKey
    return () => {
      renderApp = undefined
    }
  }, [])
  return key === null ? null : <App key={key} />
}

function context(env: CypressEnv): ConformanceCtx {
  return {
    async show(view: View) {
      // React commits the mount after `cy.mount` has already moved on.
      await until(() => renderApp !== undefined, 'cy.mount never mounted the stage')
      // The fixture reads its view from the URL, like the dom runner's. In
      // component testing that is the spec frame's own, so only the query string
      // changes; the path is Cypress's.
      window.history.replaceState({}, '', `${window.location.pathname}${viewSearch(view)}`)
      flushSync(() => renderApp?.(++renders))
      const { document } = env
      await until(
        () => document.querySelector('[data-testid="stage"]') !== null,
        'the fixture never rendered its stage',
      )
      return env
    },
  }
}

const specFrameUrl = window.location.href

function registerCatalog(options: HarnessCommandOptions): void {
  afterEach(() => {
    window.history.replaceState({}, '', specFrameUrl)
  })
  for (const spec of specs) {
    it(spec.name, () => {
      cy.mount(<Stage />)
      cy.harnessEnv(env => spec.run(context(env)), options)
    })
  }
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, () => {
      cy.mount(<Stage />)
      cy.harnessEnv(env => spec.run(context(env)), options)
    })
  }
}

// No urlSpecs: a component test has no address bar of its own to drive — the
// spec frame is the page — so goto() refuses here by design.
describe('conformance: cypress driver (component)', () => {
  registerCatalog({})
})

// The catalog again with trusted CDP input, wherever CDP exists.
if (Cypress.isBrowser({ family: 'chromium' })) {
  describe('conformance: cypress driver (component, realEvents)', () => {
    registerCatalog({ realEvents: true })
  })
}
