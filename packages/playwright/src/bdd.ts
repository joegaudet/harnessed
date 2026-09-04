/**
 * A scenario-scoped bag for the route harnesses a Gherkin scenario builds up.
 *
 * Steps are separate functions, so the obvious place to put a harness is a
 * module-level `let` — which breaks the moment Playwright reuses a worker, because
 * the next scenario inherits the last one's state. A fixture is per-scenario, so
 * it cannot leak.
 */
export interface WorldFixture<W> {
  world: Partial<W>
}

interface Extendable<T> {
  extend<U>(fixtures: {
    [K in keyof U]: (args: never, use: (value: U[K]) => Promise<void>) => Promise<void>
  }): T & Extendable<T>
}

/**
 * Adds a `world` fixture to any Playwright-shaped `test` object — plain
 * `@playwright/test` or playwright-bdd's `test`.
 *
 * ```ts
 * const test = withWorld<{ checkout: CheckoutRoute }>(baseTest)
 * const { Given, When, Then } = createBdd(test)
 * ```
 */
export function withWorld<W, T extends Extendable<T>>(base: T): T {
  return base.extend<WorldFixture<W>>({
    world: async (_args: never, use: (value: Partial<W>) => Promise<void>) => {
      await use({})
    },
  }) as T
}
