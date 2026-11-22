import type { Query } from '@harnessed-ts/core'

/** Words that read well and change nothing. */
export interface Words<Self> {
  readonly to: Self
  readonly be: Self
  readonly been: Self
  readonly is: Self
  readonly that: Self
  readonly which: Self
  readonly and: Self
  readonly has: Self
  readonly have: Self
  readonly with: Self
  readonly at: Self
  readonly of: Self
  readonly same: Self
  readonly does: Self
  readonly but: Self
  readonly still: Self
  readonly also: Self
}

/** What `include` accepts for a subject of type `R`. */
export type Member<R> = R extends string
  ? string
  : R extends readonly (infer Item)[]
    ? Item
    : R extends ReadonlySet<infer Item>
      ? Item
      : R extends object
        ? Partial<R>
        : never

/**
 * A chain on what a harness method resolves to. Every terminal is a call that
 * returns a promise: await it. `@harnessed-ts/should/bdd/register` merges more
 * terminals into this interface.
 */
export interface ValueAssertion<R> extends Words<ValueAssertion<R>> {
  readonly not: ValueAssertion<R>
  /** Equality and membership compare structure. */
  readonly deep: ValueAssertion<R>
  null(): Promise<void>
  true(): Promise<void>
  false(): Promise<void>
  undefined(): Promise<void>
  /** Strict (`===`), or structural after `.deep`. */
  equal(expected: R): Promise<void>
  equals(expected: R): Promise<void>
  eq(expected: R): Promise<void>
  /** Structural equality. */
  eql(expected: R): Promise<void>
  eqls(expected: R): Promise<void>
  match(pattern: RegExp): Promise<void>
  /** A substring, an array or set member, or a subset of an object's properties. */
  include(member: Member<R>): Promise<void>
  includes(member: Member<R>): Promise<void>
  contain(member: Member<R>): Promise<void>
  contains(member: Member<R>): Promise<void>
  above(bound: number): Promise<void>
  gt(bound: number): Promise<void>
  greaterThan(bound: number): Promise<void>
  below(bound: number): Promise<void>
  lt(bound: number): Promise<void>
  lessThan(bound: number): Promise<void>
  /** A string's or array's `length`, a Map's or Set's `size`. */
  length(expected: number): Promise<void>
  lengthOf(expected: number): Promise<void>
}

/** A chain on a target: a query, or a harness through its host. */
export interface TargetAssertion extends Words<TargetAssertion> {
  readonly not: TargetAssertion
  /** Nothing matches. */
  absent(): Promise<void>
  /** `aria-pressed="true"`. */
  selected(): Promise<void>
  /** The text equals a string or matches a pattern. */
  readAs(expected: string | RegExp): Promise<void>
}

/**
 * What a member is asserted as. A method resolving `void` is an action, not a
 * reading — and under retry it would run again — so it is left out, as is
 * anything that is neither a method nor a target.
 */
export type Asserted<V> = V extends Query | { readonly self: Query }
  ? TargetAssertion
  : V extends (...args: infer A) => Promise<infer R>
    ? [void] extends [R]
      ? never
      : [] extends A
        ? ValueAssertion<R> & ((...args: A) => ValueAssertion<R>)
        : (...args: A) => ValueAssertion<R>
    : never

/**
 * Names `harness.should` keeps for itself: the chain words, `not`, the harness
 * matchers, and what tooling probes. A harness member by one of these names
 * cannot be asserted on through `harness.should`; call it and use `expect`.
 */
export type Reserved = keyof TargetAssertion | 'should' | 'deep' | 'then' | 'toJSON' | 'toString'

/** `harness.should`: its methods and targets by name, plus the harness matchers on its host. */
export type HarnessShould<T> = {
  readonly [
    K in keyof T as K extends Reserved ? never : [Asserted<T[K]>] extends [never] ? never : K
  ]: Asserted<T[K]>
} & TargetAssertion
