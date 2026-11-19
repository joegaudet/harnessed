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
