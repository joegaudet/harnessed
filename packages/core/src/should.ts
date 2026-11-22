import { globals } from './globals'

/** Builds the `.should` chain for a harness or a query. Installed by `@harnessed-ts/should/register`. */
export type ShouldFactory = (subject: object) => unknown

/**
 * Installs the factory every `.should` getter reads. Kept in the shared slot so
 * one registration serves both the ESM and the CJS copy of core.
 */
export function registerShould(factory: ShouldFactory): void {
  globals().should = factory
}

/** Turns a just-built harness into what its constructor returns. */
export type HarnessWrapper = <T extends object>(harness: T) => T

/**
 * Makes every harness built from now on the object `wrap` returns, rather than
 * itself. `@harnessed-ts/should/register` uses it to put a `should` on each method.
 */
export function registerHarnessWrapper(wrap: HarnessWrapper): void {
  globals().wrapHarness = wrap
}

/** Puts a `should` on `reading`, a promise of a call to the method with `args`. */
export type AttachShould = (reading: Promise<unknown>, args: unknown[]) => void

interface Wrapped {
  method: object
  attach: AttachShould
}

/** Where a wrapped harness method keeps the method it stands in for. */
const WRAPPED = Symbol.for('harnessed.wrapped-method.v2')

/** Marks `wrapper` as standing in for `method`; `attach` gives a call's promise its `should`. */
export function markWrapped(wrapper: object, method: object, attach: AttachShould): void {
  Object.defineProperty(wrapper, WRAPPED, { value: { method, attach } satisfies Wrapped })
}

function wrappedBy(fn: object): Wrapped | undefined {
  return (fn as { [WRAPPED]?: Wrapped })[WRAPPED]
}

/**
 * The method a wrapper stands in for, or `fn` itself. For anything that reads a
 * method's source, as storybook's step labels do for parameter names.
 */
export function unwrapMethod<F extends object>(fn: F): F {
  return (wrappedBy(fn)?.method ?? fn) as F
}

/**
 * For anything that calls a wrapped method its own way, as storybook's steps do:
 * gives `reading`, its promise of the call, the `should` the wrapper would have.
 * Nothing happens for a method that is not wrapped.
 */
export function attachShould(fn: object, reading: Promise<unknown>, args: unknown[]): void {
  wrappedBy(fn)?.attach(reading, args)
}

/** The harness as its constructor should return it: wrapped, once a wrapper is registered. */
export function wrapHarness<T extends object>(harness: T): T {
  const slot = globals()
  const wrap = Object.hasOwn(slot, 'wrapHarness') ? slot.wrapHarness : undefined
  return wrap === undefined ? harness : wrap(harness)
}

/**
 * Puts a `should` getter on a prototype. Core owns the getter, rather than the
 * should package patching it in, so that each copy of core has its own — a
 * harness built through the CJS copy still gets `.should`. Non-enumerable, so
 * nothing that spreads or serialises a query or harness sees it.
 */
export function defineShould(prototype: object): void {
  Object.defineProperty(prototype, 'should', {
    configurable: true,
    enumerable: false,
    get(this: object): unknown {
      // An own property only: the slot is a plain object, and `chai.should()`
      // puts a `should` on Object.prototype that it would otherwise inherit.
      const slot = globals()
      const factory = Object.hasOwn(slot, 'should') ? slot.should : undefined
      if (factory === undefined) {
        // Without @harnessed-ts/should, step aside for Chai's should interface.
        const inherited = Object.getOwnPropertyDescriptor(Object.prototype, 'should')
        if (inherited?.get !== undefined) return inherited.get.call(this)
        throw new Error(
          'harnessed: `.should` is not registered. Add `import "@harnessed-ts/should/register"` to your test setup file.',
        )
      }
      return factory(this)
    },
  })
}
