import { World } from '@cucumber/cucumber'
import type { IWorldOptions } from '@cucumber/cucumber'
import type { EnvConfig } from '@harnessed-ts/core'
import { createWorld } from './index'
import type { PageMap, PageRegistry } from './index'

/**
 * A cucumber-js World with the harnessed pieces on it. Cucumber constructs one
 * per scenario, so everything here is scenario-scoped by construction.
 *
 * ```ts
 * const pageMap = { checkout: CheckoutPage }
 * const pages = definePages(pageMap)
 *
 * class AppWorld extends HarnessedWorld<{ checkout: CheckoutPage }, typeof pageMap> {
 *   override pages = pages
 * }
 * setWorldConstructor(AppWorld)
 * defineParameterType(pageParameter(pages))
 *
 * Before(async function (this: AppWorld) {
 *   this.env = pw(await this.browser.newPage())   // or wdio(browser), …
 * })
 * Given('I open the {page} page', async function (this: AppWorld, name) {
 *   this.bag.current = this.open(name)
 * })
 * ```
 */
export class HarnessedWorld<
  W = Record<string, unknown>,
  P extends PageMap = PageMap,
> extends World {
  /** The scenario's bag. Starts empty; cucumber builds a new world per scenario. */
  bag: Partial<W> = createWorld<W>()
  /** The env every harness in the scenario is built with. Set it in a `Before`. */
  env: EnvConfig | undefined
  /** The pages features can name. Assign the registry in a subclass. */
  pages: PageRegistry<P> | undefined

  constructor(options: IWorldOptions) {
    super(options)
  }

  /** Constructs a registered page with the scenario's env. */
  open<N extends keyof P & string>(name: N): InstanceType<P[N]> {
    if (this.pages === undefined) {
      throw new Error('harnessed: this world has no page registry. Assign `pages` in a subclass.')
    }
    if (this.env === undefined) {
      throw new Error('harnessed: this world has no env yet. Set `this.env` in a Before hook.')
    }
    return this.pages.open(name, this.env)
  }
}
