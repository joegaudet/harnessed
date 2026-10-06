import { createWorld } from './index'

/**
 * How a hook gets registered: Mocha's `beforeEach`, which Cypress provides as a
 * global, or anything with its shape.
 */
export type HookRegistrar = (fn: () => void) => void

export interface CypressWorldOptions {
  /**
   * Registers the reset that runs before each scenario. Defaults to the global
   * `beforeEach` Cypress provides in a spec bundle.
   */
  beforeEach?: HookRegistrar
}

export interface CypressWorld<W> {
  /** The current scenario's bag. Read it inside a step, never at module level. */
  world(): Partial<W>
}

function isHookRegistrar(value: unknown): value is HookRegistrar {
  return typeof value === 'function'
}

function globalBeforeEach(): HookRegistrar {
  const hook: unknown = Reflect.get(globalThis, 'beforeEach')
  if (!isHookRegistrar(hook)) {
    throw new Error(
      'harnessed: cypressWorld() found no global beforeEach. Call it at the top level of a ' +
        'step definitions file, which Cypress bundles into the spec, or pass { beforeEach }.',
    )
  }
  return hook
}

/**
 * A scenario-scoped world for @badeball/cypress-cucumber-preprocessor.
 *
 * Every scenario in a feature runs in the same spec bundle, so a module-level
 * `let` in a step file carries the last scenario's pages into the next one. This
 * registers a `beforeEach` that starts each scenario with an empty world; steps
 * run as Cypress commands, in order, so each one sees what the steps before it
 * left there. Steps reach the world through `world()`, never through `this`.
 *
 * Harness calls are promises, so a step runs them inside the Cypress driver's
 * bridge (`cy.harnessEnv`, `cy.harness`) — one command each:
 *
 * ```ts
 * import { defineParameterType, When } from '@badeball/cypress-cucumber-preprocessor'
 *
 * const pages = definePages({ checkout: CheckoutPage })
 * defineParameterType(pageParameter(pages))
 * const { world } = cypressWorld<{ checkout: CheckoutPage }>()
 *
 * When('I open the {page} page', (name: 'checkout') => {
 *   cy.harnessEnv(async env => {
 *     const page = pages.open(name, env)
 *     await page.goto()
 *     world().checkout = page
 *   })
 * })
 * ```
 *
 * Call it once, at the top level of a step definitions file, and share the
 * `world` it returns: each call is a separate world.
 */
export function cypressWorld<W>(options: CypressWorldOptions = {}): CypressWorld<W> {
  const beforeEach = options.beforeEach ?? globalBeforeEach()
  let current: Partial<W> | undefined
  beforeEach(() => {
    current = createWorld<W>()
  })
  return {
    world() {
      if (current === undefined) {
        throw new Error(
          'harnessed: no scenario is running yet, so there is no world. Call world() inside ' +
            'a step, not at the top level of a step definitions file.',
        )
      }
      return current
    },
  }
}
