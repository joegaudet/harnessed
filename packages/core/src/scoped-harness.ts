import type { EnvConfig } from './env'
import type { HarnessHost } from './harness-host'
import { requireHostMeta } from './host-meta'
import type { Query } from './query'
import { createQuery } from './registry'
import { frame } from './selector'
import type { Selector } from './selector'

export interface ChildHarnessOptions {
  /**
   * An `<iframe>` inside the host that the child lives in. The child resolves
   * within the frame's document, so a harness written for the framed app works
   * unchanged from the page that embeds it.
   */
  frame?: Selector
}

export function childScope(
  parent: readonly Selector[],
  options?: ChildHarnessOptions,
): readonly Selector[] {
  return options?.frame === undefined ? parent : [...parent, frame(options.frame)]
}

/**
 * Anything constructible as a harness: an env and an optional parent scope. Both
 * `ComponentHarness` and `PageHarness` subclasses satisfy it, which is what lets a
 * page nest a page as readily as it nests a component.
 */
export interface ScopedHarnessConstructor<T extends ScopedHarness = ScopedHarness> {
  new (env: EnvConfig, parentScope?: readonly Selector[]): T
  readonly name: string
}

/**
 * The host plumbing every harness shares: an env, a scope chain anchored on the
 * class's `@Harness({ host })`, and the two supported ways to reach inside it.
 *
 * `ComponentHarness` and `PageHarness` both extend this. It exists because the
 * page class's ancestor used to re-implement all of it privately — two copies of
 * `elementBy`/`childHarness` that were already drifting (one had no `self` and no
 * `count`), and any change to how a child inherits scope had to land twice.
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
   * page's `waitForReady()` waits on.
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

  /** A nested harness — a component or a page — inheriting this one's scope chain. */
  protected childHarness<T extends ScopedHarness>(
    HarnessClass: ScopedHarnessConstructor<T>,
    options?: ChildHarnessOptions,
  ): T {
    return new HarnessClass(this._env, childScope(this._scope, options))
  }
}
