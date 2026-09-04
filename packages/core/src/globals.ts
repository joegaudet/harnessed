/**
 * State that must be shared by every copy of this module in a process.
 *
 * The packages are published as both ESM and CJS. A consumer whose graph pulls in
 * both formats gets two module instances, and anything held in module scope would
 * silently exist twice — a driver registered through the ESM copy would be
 * invisible to a harness constructed through the CJS one. `Symbol.for` keys a
 * single record on `globalThis` instead, so both copies see the same state.
 */

const SLOT = Symbol.for('harnessed.globals.v1')

export interface HarnessedGlobals {
  drivers: Map<string, unknown>
  hostMeta: WeakMap<object, unknown>
  config: Record<string, unknown>
}

interface GlobalCarrier {
  [SLOT]?: HarnessedGlobals
}

export function globals(): HarnessedGlobals {
  const carrier = globalThis as GlobalCarrier
  let slot = carrier[SLOT]
  if (slot === undefined) {
    slot = { drivers: new Map(), hostMeta: new WeakMap(), config: {} }
    carrier[SLOT] = slot
  }
  return slot
}
