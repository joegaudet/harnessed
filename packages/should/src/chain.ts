import { getConfig } from '@harnessed-ts/core'
import type { Assertable, MatcherResult } from '@harnessed-ts/core'
import { AssertionError } from './error'
import { show } from './format'

export interface Flags {
  /** Set by `.deep`: equality and membership compare structure. */
  deep: boolean
}

/** What a value check decided, and how its failure message phrases it. */
export interface Verdict {
  pass: boolean
  expected: unknown
  /** Completes "expected <subject> to …": `be null`, `equal 4`. */
  phrase: string
  /** Replaces "but it was <actual>" when the actual value says too little. */
  but?: string
}

export type Settled = { ok: true; value: unknown } | { ok: false; error: unknown }

/**
 * A value assertion: decides on what the subject resolved to. One that sets
 * `acceptsRejection` is handed the `Settled` outcome instead, so it can assert
 * that the subject rejected.
 */
export interface ValueCheck {
  (actual: unknown, args: readonly unknown[], flags: Flags): Verdict
  acceptsRejection?: boolean
  /** Also a word, as Chai's `a` and `an` are: `be.an('array')` and `be.an.instanceOf(Array)`. */
  chainable?: boolean
}

/** A target assertion: reads the page through a query or a harness host. */
export type TargetCheck = (subject: Assertable, args: readonly unknown[]) => Promise<MatcherResult>

const valueChecks = new Map<string, ValueCheck>()
const targetChecks = new Map<string, TargetCheck>()

/** Adds value assertions; `@harnessed-ts/should/bdd/register` adds its vocabulary this way. */
export function addValueChecks(table: Record<string, ValueCheck>): void {
  for (const [name, check] of Object.entries(table)) valueChecks.set(name, check)
}

export function addTargetChecks(table: Record<string, TargetCheck>): void {
  for (const [name, check] of Object.entries(table)) targetChecks.set(name, check)
}

/** Read well and change nothing, as in Chai. */
const WORDS = new Set([
  'to',
  'be',
  'been',
  'is',
  'that',
  'which',
  'and',
  'has',
  'have',
  'with',
  'at',
  'of',
  'same',
  'does',
  'but',
  'still',
  'also',
])

/**
 * Properties tooling reads off any object it prints or awaits. Answering them
 * with `undefined` keeps a chain from throwing inside a reporter; `then` in
 * particular must stay undefined, or awaiting a chain without its terminal call
 * would run the chain as a thenable instead of failing to type-check.
 */
const PROBES = new Set(['then', 'toJSON', 'asymmetricMatch', '$$typeof', 'nodeType', 'constructor'])

const RETRY_INTERVAL_MS = 50

interface Attempt {
  pass: boolean
  message: () => string
  actual: unknown
  expected: unknown
}

/**
 * Runs `attempt` once, or — under `retryAssertions` — until it passes or
 * `defaultTimeout` runs out, rethrowing the last failure. An error thrown by the
 * subject is retried like a failure: under Cypress the element may not exist yet.
 */
async function settle(attempt: () => Promise<Attempt>, negate: boolean): Promise<void> {
  const { retryAssertions, defaultTimeout } = getConfig()
  const deadline = Date.now() + defaultTimeout
  for (;;) {
    let failure: unknown
    try {
      const outcome = await attempt()
      if (outcome.pass !== negate) return
      failure = new AssertionError(outcome.message(), {
        actual: outcome.actual,
        expected: outcome.expected,
        showDiff: !negate,
      })
    } catch (error) {
      failure = error
    }
    if (!retryAssertions || Date.now() >= deadline) throw failure
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS))
  }
}

interface ChainState {
  /** How the chain prints: `FormHarness.should.error.not`. */
  path: string
  negate: boolean
  deep: boolean
}

interface Terminal {
  (args: unknown[], state: ChainState): Promise<void>
  chainable?: boolean
}

/**
 * The shared proxy behind every chain: words, `not` and `deep` return a new
 * chain; a terminal name returns the call that runs the assertion. Anything
 * else is handed to `fallback`, or refused by name.
 */
function chain(
  state: ChainState,
  terminal: (name: string) => Terminal | undefined,
  fallback?: (name: string) => unknown,
  apply?: (args: unknown[]) => unknown,
): object {
  const next = (patch: Partial<ChainState>, word: string): object =>
    chain({ ...state, ...patch, path: `${state.path}.${word}` }, terminal)
  // An arrow function as the target: callable for a method that takes
  // arguments, and without a non-configurable `prototype` to trip proxy invariants.
  return new Proxy(() => undefined, {
    apply: (_target, _this, args: unknown[]) => apply?.(args),
    get(_target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => state.path
      if (prop === Symbol.toStringTag) return 'Should'
      if (typeof prop === 'symbol' || PROBES.has(prop)) return undefined
      if (prop === 'not') return next({ negate: !state.negate }, prop)
      if (prop === 'deep') return next({ deep: true }, prop)
      if (WORDS.has(prop)) return next({}, prop)
      const run = terminal(prop)
      if (run?.chainable === true) {
        const word = next({}, prop)
        return new Proxy((...args: unknown[]) => run(args, state), {
          get: (_target, key) => Reflect.get(word, key),
        })
      }
      if (run !== undefined) return (...args: unknown[]) => run(args, state)
      if (fallback !== undefined) return fallback(prop)
      throw new TypeError(
        `harnessed: "${prop}" is not a should assertion (on ${state.path}). Check the spelling, or import "@harnessed-ts/should/bdd/register" for the full BDD vocabulary.`,
      )
    },
  })
}

function targetTerminal(subject: Assertable): (name: string) => Terminal | undefined {
  return name => {
    const check = targetChecks.get(name)
    if (check === undefined) return undefined
    return (args, state) =>
      settle(async () => {
        const result = await check(subject, args)
        return { pass: result.pass, message: result.message, ...result.observed }
      }, state.negate)
  }
}

/** `query.should` and `harness.should.someQuery`: the harness matchers only. */
export function targetChain(subject: Assertable, path: string): object {
  return chain({ path, negate: false, deep: false }, targetTerminal(subject))
}

function valueChain(label: string, path: string, read: () => Promise<unknown>): object {
  return chain({ path, negate: false, deep: false }, name => {
    const check = valueChecks.get(name)
    if (check === undefined) return undefined
    const run: Terminal = (args, state) =>
      settle(async () => {
        let settled: Settled
        try {
          settled = { ok: true, value: await read() }
        } catch (error) {
          settled = { ok: false, error }
        }
        if (!settled.ok && check.acceptsRejection !== true) throw settled.error
        const actual = settled.ok ? settled.value : settled.error
        const verdict = check(check.acceptsRejection === true ? settled : actual, args, state)
        return {
          pass: verdict.pass,
          actual,
          expected: verdict.expected,
          message: () =>
            state.negate
              ? `expected ${label} not to ${verdict.phrase}`
              : `expected ${label} to ${verdict.phrase}, but ${verdict.but ?? `it was ${show(actual)}`}`,
        }
      }, state.negate)
    if (check.chainable === true) run.chainable = true
    return run
  })
}

/** `harness.should.method`, callable when the method takes arguments. */
function methodLink(harness: object, name: string, path: string, args: unknown[] = []): object {
  const owner = harness.constructor.name
  const label = `${owner}.${name}(${args.map(show).join(', ')})`
  const read = (): Promise<unknown> =>
    (harness as Record<string, (...a: unknown[]) => Promise<unknown>>)[name]!(...args)
  const link = valueChain(label, path, read)
  return new Proxy(link, {
    apply: (_target, _this, called: unknown[]) => methodLink(harness, name, path, called),
  })
}

/** Something the harness matchers can read: a query, or a harness via its host. */
function isTarget(value: unknown): value is Assertable {
  if (typeof value !== 'object' || value === null) return false
  if ('self' in value) return true
  const query = value as { attribute?: unknown; count?: unknown }
  return typeof query.attribute === 'function' && typeof query.count === 'function'
}

/**
 * `harness.should`: a member name picks what to assert on; words and the harness
 * matchers assert on the harness's own host (`form.should.be.absent()`).
 */
export function harnessChain(harness: object): object {
  const owner = harness.constructor.name
  const path = `${owner}.should`
  return chain(
    { path, negate: false, deep: false },
    targetTerminal(harness as Assertable),
    name => {
      const member = (harness as Record<string, unknown>)[name]
      if (typeof member === 'function') return methodLink(harness, name, `${path}.${name}`)
      if (isTarget(member)) return targetChain(member, `${path}.${name}`)
      throw new TypeError(
        `harnessed: ${owner}.${name} is not an async method or a target, so it cannot be asserted on.`,
      )
    },
  )
}

/** What `registerShould` is handed: a harness gets the member chain, a query the target chain. */
export function shouldFor(subject: object): unknown {
  return 'self' in subject
    ? harnessChain(subject)
    : targetChain(subject as Assertable, 'target.should')
}
