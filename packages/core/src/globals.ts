/**
 * The built-in runtime settings. Lives here rather than in `config.ts` so the
 * shared slot can be initialised without importing it at runtime.
 */
export const DEFAULT_RUNTIME_CONFIG: Readonly<RuntimeConfig> = Object.freeze({
  testIdAttribute: 'data-testid',
  defaultTimeout: 5_000,
})

/**
 * State that must be shared by every copy of this module in a process.
 *
 * The packages are published as both ESM and CJS. A consumer whose graph pulls in
 * both formats gets two module instances, and anything held in module scope would
 * silently exist twice — a driver registered through the ESM copy would be
 * invisible to a harness constructed through the CJS one. `Symbol.for` keys a
 * single record on `globalThis` instead, so both copies see the same state.
 */

import type { RuntimeConfig } from './config'
import type { HarnessOptions } from './host-meta'
import type { QueryFactory } from './registry'

const SLOT = Symbol.for('harnessed.globals.v1')

export interface HarnessedGlobals {
  drivers: Map<string, QueryFactory>
  hostMeta: WeakMap<object, HarnessOptions>
  /** Overrides applied by `configure()`, and the merged view readers get. */
  overrides: Partial<RuntimeConfig>
  merged: Readonly<RuntimeConfig>
}

interface GlobalCarrier {
  [SLOT]?: HarnessedGlobals
}

export function globals(): HarnessedGlobals {
  const carrier = globalThis as GlobalCarrier
  let slot = carrier[SLOT]
  if (slot === undefined) {
    slot = {
      drivers: new Map(),
      hostMeta: new WeakMap(),
      overrides: {},
      merged: DEFAULT_RUNTIME_CONFIG,
    }
    carrier[SLOT] = slot
  }
  return slot
}
