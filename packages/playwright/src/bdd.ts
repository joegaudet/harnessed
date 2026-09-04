import type { TestType } from '@playwright/test'

/**
 * A scenario-scoped bag for the route harnesses a Gherkin scenario builds up.
 *
 * Steps are separate functions, so the obvious place to put a harness is a
 * module-level `let` — which breaks the moment Playwright reuses a worker,
 * because the next scenario inherits the last one's state. A fixture is
 * per-scenario, so it cannot leak.
 */
export interface WorldFixture<W> {
  world: Partial<W>
}

/** Playwright's own constraint on fixture records, without reaching for `any`. */
type AnyTestType = TestType<Record<string, unknown>, Record<string, unknown>>

/**
 * The base test type with the world fixture added. Written as a conditional so
 * the base's own fixtures survive — returning the base type unchanged would make
 * `world` invisible to every step that destructures it.
 */
export type WithWorld<T, W> =
  T extends TestType<infer TestArgs, infer WorkerArgs>
    ? TestType<TestArgs & WorldFixture<W>, WorkerArgs>
    : never

/**
 * Adds a `world` fixture to any Playwright-shaped `test` — plain
 * `@playwright/test` or playwright-bdd's.
 *
 * ```ts
 * export const test = withWorld<World, typeof apiTest>(apiTest)
 * const { Given, When, Then } = createBdd(test)
 * ```
 */
export function withWorld<W, T>(base: T): WithWorld<T, W> {
  const extended = (base as AnyTestType).extend<WorldFixture<W>>({
    // Playwright requires the object-destructuring pattern here: it reads the
    // destructured names to work out what this fixture depends on, and rejects a
    // plain parameter outright. Empty means it depends on nothing.
    world: async ({}, use: (value: Partial<W>) => Promise<void>) => {
      await use({})
    },
  })
  return extended as unknown as WithWorld<T, W>
}
