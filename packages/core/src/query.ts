import type { Selector } from './selector'

export interface WaitOptions {
  /** Milliseconds to wait for the target. Falls back to the configured default. */
  timeout?: number
}

export type WaitState = 'visible' | 'hidden'

/**
 * A query descriptor — a scope chain plus a selector. Not a resolved node: nothing
 * is looked up until a method is called, which is what lets one harness field work
 * before its component has rendered and across drivers that resolve differently.
 *
 * Single-target methods resolve strictly: more than one match is an error, never a
 * silent pick of the first. Multi-target methods work across every match.
 *
 * A driver implements 19 members; everything list-shaped is inherited from here.
 */
export abstract class Query {
  constructor(
    protected readonly scope: readonly Selector[],
    protected readonly selector: Selector,
  ) {}

  // --- interactions -------------------------------------------------------
  abstract click(options?: WaitOptions): Promise<void>
  abstract fill(value: string, options?: WaitOptions): Promise<void>
  abstract clear(options?: WaitOptions): Promise<void>
  abstract check(options?: WaitOptions): Promise<void>
  abstract uncheck(options?: WaitOptions): Promise<void>
  abstract selectOption(value: string | string[], options?: WaitOptions): Promise<void>
  abstract hover(options?: WaitOptions): Promise<void>
  abstract focus(options?: WaitOptions): Promise<void>
  abstract blur(options?: WaitOptions): Promise<void>
  abstract press(key: string, options?: WaitOptions): Promise<void>

  // --- observations -------------------------------------------------------
  abstract text(options?: WaitOptions): Promise<string>
  abstract inputValue(options?: WaitOptions): Promise<string>
  abstract attribute(name: string, options?: WaitOptions): Promise<string | null>
  abstract isVisible(options?: WaitOptions): Promise<boolean>
  abstract isEnabled(options?: WaitOptions): Promise<boolean>
  abstract isChecked(options?: WaitOptions): Promise<boolean>
  abstract selectedOptions(options?: WaitOptions): Promise<string[]>

  // --- waiting ------------------------------------------------------------
  abstract waitFor(state: WaitState, options?: WaitOptions): Promise<void>

  /**
   * How many nodes match. Zero is an answer, not a failure: this resolves the
   * scope chain but counts without waiting, so asking whether something is absent
   * returns straight away instead of waiting out a retry timeout.
   */
  abstract count(): Promise<number>

  /** A copy of this query with a different selector, same scope and driver. */
  protected abstract clone(selector: Selector): Query

  // --- lists (shared by every driver) -------------------------------------

  /** True when nothing matches. Answers immediately. */
  async isAbsent(): Promise<boolean> {
    return (await this.count()) === 0
  }

  nth(index: number): Query {
    return this.clone({ ...this.selector, nth: index })
  }

  first(): Query {
    return this.nth(0)
  }

  async last(): Promise<Query> {
    const total = await this.count()
    return this.nth(total - 1)
  }

  async each(fn: (query: Query, index: number) => Promise<void>): Promise<void> {
    const total = await this.count()
    for (let index = 0; index < total; index += 1) {
      await fn(this.nth(index), index)
    }
  }

  async map<T>(fn: (query: Query, index: number) => Promise<T>): Promise<T[]> {
    const total = await this.count()
    const results: T[] = []
    for (let index = 0; index < total; index += 1) {
      results.push(await fn(this.nth(index), index))
    }
    return results
  }

  async filter(fn: (query: Query, index: number) => Promise<boolean>): Promise<Query[]> {
    const total = await this.count()
    const kept: Query[] = []
    for (let index = 0; index < total; index += 1) {
      const candidate = this.nth(index)
      if (await fn(candidate, index)) kept.push(candidate)
    }
    return kept
  }

  async texts(): Promise<string[]> {
    return this.map(query => query.text())
  }
}
