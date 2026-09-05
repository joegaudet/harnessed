import type { EnvConfig } from './env'
import { emptySet } from './errors'
import type { HarnessHost } from './harness-host'
import { requireHostMeta } from './host-meta'
import { eachOf, filterOf, lastIndex, mapOf } from './list'
import type { Query } from './query'
import { createQuery } from './registry'
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
 */
export abstract class ComponentHarness implements HarnessHost {
  /** @internal */ _env: EnvConfig
  /** @internal */ _scope: Selector[]
  /** @internal Fixed at construction; kept so `self` and `nth` need not re-slice. */
  private _parentScope: readonly Selector[]

  constructor(env: EnvConfig, parentScope: readonly Selector[] = []) {
    const { host } = requireHostMeta(this.constructor as { name?: string })
    this._env = env
    this._parentScope = parentScope
    this._scope = [...parentScope, host]
  }

  /**
   * The host element itself. The right thing when the host *is* the control — a
   * card that is itself a button has nothing inside it to click.
   */
  get self(): Query {
    return createQuery(this._env, this._parentScope, this._hostSelector)
  }

  private get _hostSelector(): Selector {
    return this._scope[this._scope.length - 1]!
  }

  /** How many instances of this component are on screen. Zero is an answer. */
  async count(): Promise<number> {
    return this.self.count()
  }

  /** True when the component is not on screen. Answers immediately. */
  async isAbsent(): Promise<boolean> {
    return (await this.count()) === 0
  }

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

  async each(fn: (harness: this, index: number) => Promise<void>): Promise<void> {
    return eachOf(this, fn)
  }

  async map<T>(fn: (harness: this, index: number) => Promise<T>): Promise<T[]> {
    return mapOf(this, fn)
  }

  async filter(fn: (harness: this, index: number) => Promise<boolean>): Promise<this[]> {
    return filterOf(this, fn)
  }

  /**
   * A target whose selector is only known at call time — a table cell addressed by
   * row and column, say. Keeps this harness's scope, which is the reason to use it
   * rather than reaching for the driver's own query API.
   */
  protected elementBy(selector: Selector): Query {
    return createQuery(this._env, this._scope, selector)
  }

  /** A nested harness, inheriting this one's scope chain. */
  protected childHarness<T extends ComponentHarness>(
    HarnessClass: ComponentHarnessConstructor<T>,
  ): T {
    return new HarnessClass(this._env, this._scope)
  }
}
