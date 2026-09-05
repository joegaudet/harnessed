import { globals } from './globals'
import type { Selector } from './selector'

export interface HarnessOptions {
  /**
   * The selector matching the component's root element. Anchor it on a test id,
   * never on copy — copy changes without warning and takes the harness with it.
   */
  host: Selector
}

/** Records a class's host. Called by `@Harness`. */
export function setHostMeta(target: object, options: HarnessOptions): void {
  globals().hostMeta.set(target, options)
}

/**
 * Finds the host for a class, walking up the prototype chain and taking the
 * nearest entry.
 *
 * This is what makes an abstract intermediate harness work: a base class can carry
 * decorated fields and behavioural methods with no host of its own, and each
 * subclass supplies one. The nearest-wins rule also means a subclass can override
 * a base's host rather than inherit it.
 */
export function findHostMeta(target: object): HarnessOptions | undefined {
  const store = globals().hostMeta
  let current: object | null = target
  while (current !== null && current !== Function.prototype) {
    const found = store.get(current)
    if (found !== undefined) return found
    current = Object.getPrototypeOf(current) as object | null
  }
  return undefined
}

export function requireHostMeta(target: { name?: string }): HarnessOptions {
  const meta = findHostMeta(target)
  if (meta === undefined) {
    const name = target.name ?? 'this harness'
    throw new Error(
      `harnessed: ${name} has no host. Decorate it with @Harness({ host: testId('…') }), ` +
        `or, if it is an abstract base, decorate the subclass being constructed.`,
    )
  }
  return meta
}
