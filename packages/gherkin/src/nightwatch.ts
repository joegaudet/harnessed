import type { EnvConfig } from '@harnessed-ts/core'
import { nightwatch } from '@harnessed-ts/nightwatch'
import type { NightwatchAPI } from 'nightwatch'

export { HarnessedWorld } from './cucumber'

/**
 * What the hook needs of a world — any `HarnessedWorld`, whatever its pages —
 * as Nightwatch's Cucumber runner hands it over: the runner's own `Before`
 * launches a browser for each scenario and sets it on the world as `browser`.
 */
export interface NightwatchWorld {
  env: EnvConfig | undefined
  browser?: NightwatchAPI
}

function browserOf(world: NightwatchWorld): NightwatchAPI {
  const browser = world.browser ?? (Reflect.get(globalThis, 'browser') as NightwatchAPI | undefined)
  if (browser === undefined) {
    throw new Error(
      'harnessed: Nightwatch has not started a browser for this scenario. Leave ' +
        'test_runner.options.auto_start_session on, or launch one and set this.env = nightwatch(browser) yourself.',
    )
  }
  return browser
}

/**
 * A `Before` hook for Nightwatch's Cucumber runner: builds the scenario's env
 * from the browser Nightwatch launched for it, so `this.open(name)` works in
 * every step. Nightwatch registers its own `Before` ahead of the step files,
 * so the browser is there by the time this runs.
 *
 * ```ts
 * import { Before, setWorldConstructor, When } from '@cucumber/cucumber'
 * import { definePages } from '@harnessed-ts/gherkin'
 * import { HarnessedWorld, nightwatchEnv } from '@harnessed-ts/gherkin/nightwatch'
 *
 * const pageMap = { checkout: CheckoutPage }
 * class AppWorld extends HarnessedWorld<{ checkout: CheckoutPage }, typeof pageMap> {
 *   override pages = definePages(pageMap)
 * }
 * setWorldConstructor(AppWorld)
 * Before(nightwatchEnv)
 *
 * When('I open the {page} page', async function (this: AppWorld, name: 'checkout') {
 *   this.bag.checkout = this.open(name)
 *   await this.bag.checkout.goto() // browser.navigateTo(), against launch_url
 * })
 * ```
 */
export function nightwatchEnv(this: NightwatchWorld): void {
  this.env = nightwatch(browserOf(this))
}
