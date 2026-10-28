import { Component, signal } from '@angular/core'
import type { OnDestroy } from '@angular/core'
import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { timeoutFor } from '@harnessed-ts/core'
import type { CypressEnv, HarnessCommandOptions } from '@harnessed-ts/cypress'
import { ConformanceApp } from '../../src/app/fixture/conformance-app'

/** Resolves once `ready()` holds, polling; rejects after the default timeout. */
async function until(ready: () => boolean, failure: string): Promise<void> {
  const deadline = Date.now() + timeoutFor()
  while (!ready()) {
    if (Date.now() > deadline) throw new Error(failure)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

/** What the mounted Stage renders: a URL, and a key that forces a fresh app each time. */
const rendering = signal<{ url: string; key: number } | null>(null)
let mounted = false
let renders = 0

/**
 * What `cy.mount` mounts. A spec picks its view from inside the bridge's
 * promise, where `cy.mount` cannot be enqueued — so the mounted component waits,
 * and `show()` tells it which URL to render once the view is known. Setting
 * the signal is enough: zoneless, it schedules the render itself.
 */
@Component({
  selector: 'test-stage',
  imports: [ConformanceApp],
  template: `
    @if (rendering(); as at) {
      @for (key of [at.key]; track key) {
        <fixture-app [url]="at.url" />
      }
    }
  `,
})
class Stage implements OnDestroy {
  protected readonly rendering = rendering

  constructor() {
    rendering.set(null)
    mounted = true
  }

  ngOnDestroy(): void {
    mounted = false
  }
}

function context(env: CypressEnv): ConformanceCtx {
  return {
    async show(view: View) {
      await until(() => mounted, 'cy.mount never mounted the stage')
      // The fixture reads its view from its `url` input, as in the TestBed runs.
      rendering.set({ url: `/${viewSearch(view)}`, key: ++renders })
      const { document } = env
      await until(
        () => document.querySelector('[data-testid="stage"]') !== null,
        'the fixture never rendered its stage',
      )
      return env
    },
  }
}

function registerCatalog(options: HarnessCommandOptions): void {
  for (const spec of specs) {
    it(spec.name, () => {
      cy.mount(Stage)
      cy.harnessEnv(env => spec.run(context(env)), options)
    })
  }
  for (const spec of pageSpecs) {
    it(`page: ${spec.name}`, () => {
      cy.mount(Stage)
      cy.harnessEnv(env => spec.run(context(env)), options)
    })
  }
}

// No urlSpecs: a component test has no address bar of its own to drive — the
// spec frame is the page — so goto() refuses here by design.
describe('conformance: cypress driver (Angular component)', () => {
  registerCatalog({})
})

// The catalog again with trusted CDP input, wherever CDP exists.
if (Cypress.isBrowser({ family: 'chromium' })) {
  describe('conformance: cypress driver (Angular component, realEvents)', () => {
    registerCatalog({ realEvents: true })
  })
}
