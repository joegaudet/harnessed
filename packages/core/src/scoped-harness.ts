import type { ComponentHarness, ComponentHarnessConstructor } from './component-harness'
import type { EnvConfig } from './env'
import type { HarnessHost } from './harness-host'
import { requireHostMeta } from './host-meta'
import type { Query } from './query'
import { createQuery } from './registry'
import type { Selector } from './selector'

/**
 * The host plumbing every harness shares: an env, a scope chain anchored on the
 * class's `@Harness({ host })`, and the two supported ways to reach inside it.
 *
 * `ComponentHarness` and `RouteHarness` both extend this. It exists because the
 * route class used to re-implement all of it privately — two copies of
 * `elementBy`/`childHarness` that were already drifting (the route copy had no
 * `self` and no `count`), and any change to how a child inherits scope had to
 * land twice.
 *
 * The import cycle with `component-harness.ts` is type-only and therefore erased;
 * keep those imports `type`-qualified.
 */
export abstract class ScopedHarness implements HarnessHost {
  /** @internal */ _env: EnvConfig
  /** @internal */ _scope: Selector[]
  /** @internal Fixed at construction; kept so `self` and `nth` need not re-slice. */
  protected _parentScope: readonly Selector[]

  constructor(env: EnvConfig, parentScope: readonly Selector[] = []) {
    const { host } = requireHostMeta(this.constructor as { name?: string })
    this._env = env
    this._parentScope = parentScope
    this._scope = [...parentScope, host]
  }

  protected get _hostSelector(): Selector {
    return this._scope[this._scope.length - 1]!
  }

  /**
   * The host element itself. The right thing when the host *is* the control — a
   * card that is itself a button has nothing inside it to click — and the thing a
   * route's `waitForReady()` waits on.
   */
  get self(): Query {
    return createQuery(this._env, this._parentScope, this._hostSelector)
  }

  /** How many instances of the host are on screen. Zero is an answer. */
  async count(): Promise<number> {
    return this.self.count()
  }

  /** True when the host is not on screen. Answers immediately. */
  async isAbsent(): Promise<boolean> {
    return (await this.count()) === 0
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
