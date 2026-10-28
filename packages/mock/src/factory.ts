/**
 * Deterministic test data. No randomness: the same build in the same order gives
 * the same values, so a failure reproduces and a snapshot stays stable.
 */

const SEQUENCE = Symbol.for('harnessed.mock.sequence')
const CYCLE = Symbol.for('harnessed.mock.cycle')

interface Sequence<T> {
  readonly [SEQUENCE]: (n: number) => T
}

interface Cycle<T> {
  readonly [CYCLE]: readonly T[]
}

/**
 * A value computed from the build's sequence number, starting at 1.
 *
 * ```ts
 * defineFactory<User>({ id: seq(n => `user-${n}`), email: seq(n => `user${n}@example.com`) })
 * ```
 */
export function seq<T = number>(make?: (n: number) => T): Sequence<T> {
  return { [SEQUENCE]: make ?? ((n: number) => n as T) }
}

/** Cycles through `values` in order, one per build. */
export function oneOf<T>(...values: T[]): Cycle<T> {
  return { [CYCLE]: values }
}

type FieldSpec<V> = V | Sequence<V> | Cycle<V> | ((n: number) => V)

export type FactoryDefaults<T> = { [K in keyof T]: FieldSpec<T[K]> }

export interface Factory<T, Traits extends string = never> {
  /** One object; `overrides` win over the defaults and over any traits. */
  build(overrides?: Partial<T>): T
  buildList(count: number, overrides?: Partial<T> | ((index: number) => Partial<T>)): T[]
  /** The same factory with a named trait's fields applied first. Shares the sequence. */
  with(...traits: Traits[]): Factory<T, Traits>
  /** Restarts the sequence. Call between tests if builds must not depend on order. */
  reset(): void
}

function isSequence(value: unknown): value is Sequence<unknown> {
  return typeof value === 'object' && value !== null && SEQUENCE in value
}

function isCycle(value: unknown): value is Cycle<unknown> {
  return typeof value === 'object' && value !== null && CYCLE in value
}

/**
 * ```ts
 * const users = defineFactory<User, 'admin'>(
 *   { id: seq(String), name: 'Ada', role: 'member' },
 *   { traits: { admin: { role: 'admin' } } },
 * )
 * users.build()                    // { id: '1', name: 'Ada', role: 'member' }
 * users.with('admin').build()      // { id: '2', name: 'Ada', role: 'admin' }
 * users.buildList(2, { name: 'Bo' })
 * ```
 *
 * A plain function field is called with the sequence number too; to store a
 * function as a value, wrap it: `() => fn`.
 */
export function defineFactory<T extends object, Traits extends string = never>(
  defaults: FactoryDefaults<T>,
  options?: { traits?: Record<Traits, Partial<FactoryDefaults<T>>> },
): Factory<T, Traits> {
  const counter = { n: 0 }
  const make = (applied: readonly Traits[]): Factory<T, Traits> => {
    const resolve = (spec: unknown, n: number): unknown => {
      if (isSequence(spec)) return spec[SEQUENCE](n)
      if (isCycle(spec)) return spec[CYCLE][(n - 1) % spec[CYCLE].length]
      if (typeof spec === 'function') return (spec as (n: number) => unknown)(n)
      // Copied, so a test that mutates one build cannot change the next.
      return typeof spec === 'object' && spec !== null ? structuredClone(spec) : spec
    }
    const factory: Factory<T, Traits> = {
      build(overrides) {
        const n = ++counter.n
        const layered: Record<string, unknown> = { ...defaults }
        for (const trait of applied) Object.assign(layered, options?.traits?.[trait])
        const out: Record<string, unknown> = {}
        for (const [key, spec] of Object.entries(layered)) out[key] = resolve(spec, n)
        return { ...out, ...overrides } as T
      },
      buildList(count, overrides) {
        return Array.from({ length: count }, (_, index) =>
          factory.build(typeof overrides === 'function' ? overrides(index) : overrides),
        )
      },
      with(...traits) {
        return make([...applied, ...traits])
      },
      reset() {
        counter.n = 0
      },
    }
    return factory
  }
  return make([])
}
