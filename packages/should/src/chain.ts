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

interface Tables {
  value: Map<string, ValueCheck>
  target: Map<string, TargetCheck>
}

/**
 * The vocabulary, kept on `globalThis` for the reason core keeps its registry
 * there: the ESM and CJS copies of this package must share one, or whichever
 * copy registered last would decide which assertions exist.
 */
const TABLES = Symbol.for('harnessed.should.tables.v1')
const tables = ((globalThis as { [TABLES]?: Tables })[TABLES] ??= {
  value: new Map(),
  target: new Map(),
})
const valueChecks = tables.value
const targetChecks = tables.target

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
 * with `undefined` keeps a chain from throwing inside a reporter. A chain is
 * not thenable: awaiting one asserts nothing, and is the reporter's business,
 * not ours. An uncalled terminal is thenable, and rejects; see `terminalCall`.
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
  /** How the chain prints: `FormHarness.error.should.not`. */
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
 * else is refused by name.
 */
function chain(state: ChainState, terminal: (name: string) => Terminal | undefined): object {
  const next = (patch: Partial<ChainState>, word: string): object =>
    chain({ ...state, ...patch, path: `${state.path}.${word}` }, terminal)
  // An arrow function as the target, so a call on a word reaches `apply`, and
  // without a non-configurable `prototype` to trip proxy invariants.
  return new Proxy(() => undefined, {
    apply: () => {
      const word = state.path.slice(state.path.lastIndexOf('.') + 1)
      throw new TypeError(`harnessed: "${word}" is not a call (on ${state.path}).`)
    },
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
        const call = terminalCall(prop, args => run(args, state))
        return new Proxy(call, {
          get: (target, key) => (key === 'then' ? target.then : Reflect.get(word, key)),
        })
      }
      if (run !== undefined) return terminalCall(prop, args => run(args, state))
      throw new TypeError(
        `harnessed: "${prop}" is not a should assertion (on ${state.path}). Check the spelling, or import "@harnessed-ts/should/bdd/register" for the full BDD vocabulary.`,
      )
    },
  })
}

/**
 * A terminal, callable. It is also a thenable that rejects, because
 * `await form.should.be.null` — Chai's property style — type-checks (TypeScript
 * lets anything be awaited) and would otherwise pass without asserting.
 */
function terminalCall(
  name: string,
  call: (args: unknown[]) => Promise<void>,
): ((...args: unknown[]) => Promise<void>) & PromiseLike<never> {
  return Object.assign((...args: unknown[]) => call(args), {
    then<A, B>(_onFulfilled?: unknown, onRejected?: (reason: unknown) => A | B): Promise<A | B> {
      const error = new TypeError(`harnessed: \`.${name}\` is a call: write \`.${name}()\`.`)
      return Promise.reject(error).then(undefined, onRejected)
    },
  }) as ((...args: unknown[]) => Promise<void>) & PromiseLike<never>
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

/** A chain on what `read` resolves to; `label` names it in failure messages. */
export function valueChain(label: string, path: string, read: () => Promise<unknown>): object {
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

/** What `registerShould` is handed: a harness asserts on its host, a query on itself. */
export function shouldFor(subject: object): unknown {
  const path = 'self' in subject ? `${subject.constructor.name}.should` : 'target.should'
  return targetChain(subject as Assertable, path)
}
