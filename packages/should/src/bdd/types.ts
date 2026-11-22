import type { Member } from '../types'

/** What `members` and `oneOf` compare against for a subject of type `R`. */
type Items<R> = R extends readonly (infer Item)[] ? Item[] : never

/** Constructor-ish: what `instanceOf` and `rejectedWith` accept. */
type Class = abstract new (...args: never[]) => unknown

declare module '../types' {
  // Merged into the core chain: `@harnessed-ts/should/bdd/register` installs
  // these terminals at runtime. Every one returns a promise: await it.
  interface ValueAssertion<R> {
    ok(): Promise<void>
    exist(): Promise<void>
    /** A zero-length string or array, a zero-size Map or Set, or an object with no keys. */
    empty(): Promise<void>
    /** Chai's type names: `string`, `array`, `object`, `null`, `date`, … Also a word: `be.an.instanceOf(Array)`. */
    readonly a: ValueAssertion<R> & ((type: string) => Promise<void>)
    readonly an: ValueAssertion<R> & ((type: string) => Promise<void>)
    instanceOf(type: Class): Promise<void>
    instanceof(type: Class): Promise<void>
    property(name: PropertyKey, value?: unknown): Promise<void>
    ownProperty(name: PropertyKey, value?: unknown): Promise<void>
    haveOwnProperty(name: PropertyKey, value?: unknown): Promise<void>
    /** Exactly these keys, as a list or as arguments. */
    keys(...keys: (string | string[])[]): Promise<void>
    /** The same members, in any order. */
    members(expected: Items<R>): Promise<void>
    oneOf(list: readonly R[]): Promise<void>
    string(part: string): Promise<void>
    least(bound: number): Promise<void>
    gte(bound: number): Promise<void>
    most(bound: number): Promise<void>
    lte(bound: number): Promise<void>
    within(low: number, high: number): Promise<void>
    closeTo(expected: number, delta: number): Promise<void>
    approximately(expected: number, delta: number): Promise<void>
    satisfy(predicate: (value: R) => boolean): Promise<void>
    NaN(): Promise<void>
    finite(): Promise<void>
    frozen(): Promise<void>
    sealed(): Promise<void>
    extensible(): Promise<void>
    /** The method rejected. */
    rejected(): Promise<void>
    /** Rejected with a message containing a string, matching a pattern, or an instance of a class. */
    rejectedWith(expected: string | RegExp | Class): Promise<void>
  }
}

export type { Member }
