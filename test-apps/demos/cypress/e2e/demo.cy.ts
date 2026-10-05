import { viewSearch } from '@harnessed-ts/conformance'
import { navigationFor, timeoutFor } from '@harnessed-ts/core'
import type { CypressEnv } from '@harnessed-ts/cypress'
import { demo } from '../../src/demo'
import { MARK_COLORS, sleep, STEP_PAUSE_MS, stepper, TAIL_MS } from '../../src/timeline'

const RECORDING = Cypress.expose('DEMO_RECORD') === '1'
/** `react` or `ember`: which app `baseUrl` points at, for naming the recording. */
const APP: string = Cypress.expose('DEMO_APP') ?? 'react'

/** Resolves once the fixture has rendered its stage into the AUT document. */
async function stageRendered(env: CypressEnv): Promise<void> {
  const deadline = Date.now() + timeoutFor()
  while (env.document.querySelector('[data-testid="stage"]') === null) {
    if (Date.now() > deadline) throw new Error('the fixture never rendered its stage')
    await sleep(20)
  }
}

/**
 * Cypress's video carries no clock the spec can read, so each step also flips a
 * small square in the runner's corner — outside the app, which the GIF crops out.
 * The recorder finds the flips in the footage and times the steps from them; the
 * end is the last step plus what the spec's own clock says it took.
 */
function mark(color: string): void {
  const runner = window.top!.document
  let square = runner.getElementById('demo-sync-mark')
  if (square === null) {
    square = runner.createElement('div')
    square.id = 'demo-sync-mark'
    square.style.cssText =
      'position:fixed;left:0;bottom:0;width:24px;height:24px;z-index:2147483647;pointer-events:none'
    runner.body.appendChild(square)
  }
  square.style.background = color
}

describe(`the demo under Cypress (${APP})`, () => {
  it('runs the demo under Cypress', () => {
    const started = Date.now()
    const { steps, step } = stepper({
      now: () => Date.now() - started,
      pauseMs: RECORDING ? STEP_PAUSE_MS : 0,
      onStep: index => {
        if (RECORDING) mark(MARK_COLORS[index % 2]!)
      },
    })
    let end = 0

    cy.harnessEnv(
      async env => {
        await demo({
          async show(view) {
            await navigationFor(env).goto(env, `/${viewSearch(view)}`)
            await stageRendered(env)
            return env
          },
          step,
        })
        end = Date.now() - started
        if (RECORDING) await sleep(TAIL_MS)
      },
      { timeout: 120_000 },
    )

    if (RECORDING) {
      cy.then(() => cy.task('saveTimeline', { env: `cypress-${APP}`, steps, end }))
    }
  })
})
