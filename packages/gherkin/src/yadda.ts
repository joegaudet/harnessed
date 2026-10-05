import type { EnvConfig } from '@harnessed-ts/core'
import Yadda from 'yadda'
import { createWorld, pageParameter } from './index'
import type { PageMap, PageRegistry } from './index'

/**
 * A Yadda dictionary with a `$page` term built from a page registry — the same
 * names and pattern as `{page}`, so the two cannot drift. A step reading
 * `I open the $page page` matches only a registered name (longest first), and a
 * feature naming an unknown page fails as an undefined step, where the typo is.
 *
 * Pass `dictionary` to add the term to one that already defines others, and
 * `term` to call it something else.
 */
export function pageDictionary<P extends PageMap>(
  registry: PageRegistry<P>,
  options: { term?: string; dictionary?: Yadda.Dictionary } = {},
): Yadda.Dictionary {
  const { regexp, transformer } = pageParameter(registry)
  const dictionary = options.dictionary ?? new Yadda.Dictionary()
  // An async converter: Yadda counts a callback converter's captures from its
  // arity, an async one's from its parameters, and only the latter types cleanly.
  return dictionary.define(options.term ?? 'page', `(${regexp.source})`, async (match: string) =>
    transformer(match),
  )
}

/** What a harnessed Yadda step receives first. */
export interface YaddaScenario<W, P extends PageMap> {
  /** The scenario's bag: empty when the scenario starts, shared by its steps. */
  readonly world: Partial<W>
  /** Constructs a registered page with the scenario's env. */
  open<N extends keyof P & string>(name: N): InstanceType<P[N]>
  /**
   * Yadda's own context for the step: `step` (the line being run) and whatever
   * the runner passed in — ember-cli-yadda's `ctx`, and the QUnit test context.
   */
  readonly context: Readonly<Record<string, unknown>>
}

/** A step: the scenario first, then the values its signature captured. */
export type YaddaStep<W, P extends PageMap, A extends unknown[]> = (
  scenario: YaddaScenario<W, P>,
  ...args: A
) => unknown

export interface YaddaStepsOptions<P extends PageMap> {
  /** The pages features can name. Defines `$page` unless `dictionary` is given. */
  pages: PageRegistry<P>
  /**
   * The env pages are built with. Called each time a step opens a page, so it
   * can read per-test state — `() => ember()` in an application test.
   */
  env: () => EnvConfig
  /** The dictionary signatures expand against. Defaults to `pageDictionary(pages)`. */
  dictionary?: Yadda.Dictionary
  /** The step keywords' language. Defaults to English. */
  language?: Yadda.Language
}

/** A step library whose steps share one world. */
export interface YaddaSteps<W, P extends PageMap> {
  /** The world this library's steps share. */
  readonly world: Partial<W>
  /** The Yadda library to run: what an ember-cli-yadda steps module returns. */
  readonly library: Yadda.BaseLibrary
  given<A extends unknown[]>(signature: Yadda.Signature, step: YaddaStep<W, P, A>): this
  when<A extends unknown[]>(signature: Yadda.Signature, step: YaddaStep<W, P, A>): this
  then<A extends unknown[]>(signature: Yadda.Signature, step: YaddaStep<W, P, A>): this
  /** A step that matches after any keyword: `Given`, `When`, `Then`, `And`, `But`. */
  step<A extends unknown[]>(signature: Yadda.Signature, step: YaddaStep<W, P, A>): this
}

/** Fixes the world's type; `steps` then infers the pages from the registry. */
export interface YaddaWorld<W> {
  /** A fresh step library with a fresh, empty world. Build one per scenario. */
  steps<P extends PageMap>(options: YaddaStepsOptions<P>): YaddaSteps<W, P>
}

/**
 * Yadda steps with a scenario-scoped world and the page registry. Steps are
 * plain (arrow) functions taking the scenario first, then what their signature
 * captured; every step is awaited.
 *
 * The world belongs to the library `steps()` builds, so build one per scenario —
 * which is what ember-cli-yadda already does: it calls a steps module's default
 * export inside each scenario's test.
 *
 * ```ts
 * // tests/acceptance/steps/checkout-steps.ts
 * const pages = definePages({ checkout: CheckoutPage })
 * const checkout = yaddaWorld<{ checkout: CheckoutPage }>()
 *
 * export default function (assert: Assert) {
 *   const steps = checkout.steps({ pages, env: () => ember() })
 *   steps.when('I open the $page page', async ({ world, open }, name: 'checkout') => {
 *     world.checkout = open(name)
 *     await world.checkout.goto()
 *   })
 *   return steps.library
 * }
 * ```
 *
 * The world's type is a call of its own because TypeScript cannot take one type
 * argument explicitly and infer another; `steps` infers the pages.
 */
export function yaddaWorld<W = Record<string, unknown>>(): YaddaWorld<W> {
  return {
    steps<P extends PageMap>(options: YaddaStepsOptions<P>) {
      return createSteps<W, P>(options)
    },
  }
}

function createSteps<W, P extends PageMap>(options: YaddaStepsOptions<P>): YaddaSteps<W, P> {
  const { pages, env } = options
  const language = options.language ?? Yadda.localisation.English
  const library = language.localise(
    new Yadda.ContextParamLibrary(options.dictionary ?? pageDictionary(pages)),
  )
  const world = createWorld<W>()
  const open = <N extends keyof P & string>(name: N): InstanceType<P[N]> => pages.open(name, env())

  // Yadda passes the step's context first and, in promise mode, its completion
  // callback last; a harnessed step sees neither, only the scenario and the
  // captured values. Promise mode is explicit so Yadda never guesses from the
  // wrapper's arity.
  const wrap =
    <A extends unknown[]>(step: YaddaStep<W, P, A>) =>
    async (context: Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
      await step({ world, open, context }, ...(rest.slice(0, -1) as A))
    }
  const promise: Yadda.DefineOptions = { mode: 'promise' }

  // Every step keyword the language has, as one alternation: `the world is
  // empty` is the same step after `Given` as after `Then`.
  const anyKeyword = `(?:${['given', 'when', 'then'].map(keyword => language.translate(keyword)).join('|')})`

  return {
    world,
    library,
    given(signature, step) {
      library.given(signature, wrap(step), undefined, promise)
      return this
    },
    when(signature, step) {
      library.when(signature, wrap(step), undefined, promise)
      return this
    },
    then(signature, step) {
      library.then(signature, wrap(step), undefined, promise)
      return this
    },
    step(signature, step) {
      const signatures = Array.isArray(signature) ? signature : [signature]
      library.define(
        signatures.map(one => withKeyword(anyKeyword, one)),
        wrap(step),
        undefined,
        promise,
      )
      return this
    },
  }
}

/** Prefixes a signature with a keyword pattern, the way a Yadda language does. */
function withKeyword(keyword: string, signature: string | RegExp): string {
  const source = signature instanceof RegExp ? signature.source : signature
  return `^(?:\\s)*${keyword}\\s+${source.replace(/^\^/, '')}`
}
