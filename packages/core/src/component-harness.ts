import type { EnvConfig } from './env'
import { emptySet } from './errors'
import { eachOf, filterOf, lastIndex, mapOf } from './list'
import { ScopedHarness } from './scoped-harness'
import { nth as withNth } from './selector'
import type { Selector } from './selector'

export interface ComponentHarnessConstructor<T extends ComponentHarness = ComponentHarness> {
  new (env: EnvConfig, parentScope?: readonly Selector[]): T
  readonly name: string
}

/**
 * One per component. A harness lets a test drive a component the way a person
 * would, through methods named for what the component does — never through its DOM
 * structure, classes, or internal state.
 *
 * Element fields belong behind `private accessor`; the public surface is behaviour.
 * The same class works under every driver, because it never touches one.
 *
 * The host plumbing (`self`, `count`, `elementBy`, `childHarness`) lives on
 * `ScopedHarness`; what this adds is addressing one component among several
 * occurrences of the same host.
 */
export abstract class ComponentHarness extends ScopedHarness {
  nth(index: number): this {
    const Ctor = this.constructor as new (env: EnvConfig, parentScope?: readonly Selector[]) => this
    // The constructor has to run: it is what re-initialises the decorated
    // accessor fields. Its `_scope` is then replaced, because this instance
    // addresses one specific occurrence of the host rather than all of them.
    const instance = new Ctor(this._env, this._parentScope)
    instance._scope = [...this._parentScope, withNth(this._hostSelector, index)]
    return instance
  }

  first(): this {
    return this.nth(0)
  }

  async last(): Promise<this> {
    const index = lastIndex(await this.count())
    if (index === undefined) throw emptySet(this._parentScope, this._hostSelector)
    return this.nth(index)
  }

  /** Every on-screen occurrence, as one harness instance each. */
  async all(): Promise<this[]> {
    const total = await this.count()
    return Array.from({ length: total }, (_, index) => this.nth(index))
  }

  async each(fn: (harness: this, index: number) => Promise<void>): Promise<void> {
    return eachOf(this, fn)
  }

  async map<T>(fn: (harness: this, index: number) => Promise<T>): Promise<T[]> {
    return mapOf(this, fn)
  }

  async filter(fn: (harness: this, index: number) => Promise<boolean>): Promise<this[]> {
    return filterOf(this, fn)
  }
}
