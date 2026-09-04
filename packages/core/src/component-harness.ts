import type { EnvConfig } from './env'
import type { HarnessHost } from './harness-host'
import { requireHostMeta } from './host-meta'
import type { Query } from './query'
import { createQuery } from './registry'
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

  constructor(env: EnvConfig, parentScope: readonly Selector[] = []) {
    const { host } = requireHostMeta(this.constructor as { name?: string })
    this._env = env
    this._scope = [...parentScope, host]
  }

  /**
   * The host element itself. The right thing when the host *is* the control — a
   * card that is itself a button has nothing inside it to click.
   */
  get self(): Query {
    return createQuery(this._env, this._scope.slice(0, -1), this._hostSelector)
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
    const instance = new Ctor(this._env, this._scope.slice(0, -1))
    instance._scope = [
      ...this._scope.slice(0, -1),
      { ...this._hostSelector, nth: index } as Selector,
    ]
    return instance
  }

  first(): this {
    return this.nth(0)
  }

  async last(): Promise<this> {
    return this.nth((await this.count()) - 1)
  }

  async each(fn: (harness: this, index: number) => Promise<void>): Promise<void> {
    const total = await this.count()
    for (let index = 0; index < total; index += 1) {
      await fn(this.nth(index), index)
    }
  }

  async map<T>(fn: (harness: this, index: number) => Promise<T>): Promise<T[]> {
    const total = await this.count()
    const results: T[] = []
    for (let index = 0; index < total; index += 1) {
      results.push(await fn(this.nth(index), index))
    }
    return results
  }

  async filter(fn: (harness: this, index: number) => Promise<boolean>): Promise<this[]> {
    const total = await this.count()
    const kept: this[] = []
    for (let index = 0; index < total; index += 1) {
      const candidate = this.nth(index)
      if (await fn(candidate, index)) kept.push(candidate)
    }
    return kept
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
