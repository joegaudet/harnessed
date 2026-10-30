import type { ApiMock } from './api-mock'
import type { MockTransport } from './transport'

/**
 * Shared by every copy of this module in a process, for the same reason core's
 * slot is: an ESM and a CJS copy must see one registry, or a transport
 * registered through one is invisible to a mock created through the other.
 */
const SLOT = Symbol.for('harnessed.mock.globals.v1')

export interface MockGlobals {
  transports: Map<string, MockTransport>
  /** One mock per network, keyed by `MockTransport.key(env)`. */
  mocks: WeakMap<object, ApiMock>
  /** The same mocks, iterable, for `resetMocks()`. */
  live: Set<ApiMock>
}

interface Carrier {
  [SLOT]?: MockGlobals
}

export function globals(): MockGlobals {
  const carrier = globalThis as Carrier
  carrier[SLOT] ??= { transports: new Map(), mocks: new WeakMap(), live: new Set() }
  return carrier[SLOT]
}
