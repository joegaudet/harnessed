import type { EnvConfig } from './env'
import { globals } from './globals'
import type { Query } from './query'
import type { Selector } from './selector'

export type QueryFactory = (env: EnvConfig, scope: readonly Selector[], selector: Selector) => Query

/**
 * Registers a driver under an id. Core knows nothing about any driver: each one
 * registers itself when imported, which is what keeps this package installable
 * without Playwright or Testing Library present.
 */
export function registerDriver(id: string, factory: QueryFactory): void {
  globals().drivers.set(id, factory)
}

export function registeredDrivers(): string[] {
  return [...globals().drivers.keys()].sort()
}

/** The one place a driver is chosen. Everything after this is driver-agnostic. */
export function createQuery(env: EnvConfig, scope: readonly Selector[], selector: Selector): Query {
  const factory = globals().drivers.get(env.driver) as QueryFactory | undefined
  if (factory === undefined) {
    const known = registeredDrivers()
    const suffix =
      known.length === 0
        ? 'No driver is registered. Import a driver package for its side effect, e.g. `import { dom } from "@harnessed/dom"`.'
        : `Registered drivers: ${known.join(', ')}.`
    throw new Error(`harnessed: no driver registered for "${env.driver}". ${suffix}`)
  }
  return factory(env, scope, selector)
}
