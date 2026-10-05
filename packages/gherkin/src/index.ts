import type { EnvConfig } from '@harnessed-ts/core'

/**
 * Gherkin support for harnessed: what every runner needs, with no runner in it.
 *
 * - A **world** — the scenario-scoped bag where steps keep the pages a scenario
 *   builds up. Steps are separate functions, so the obvious place for a harness
 *   is a module-level `let`, which leaks into the next scenario the moment a
 *   runner reuses a worker. Each runner adapter gives the bag the right lifetime.
 * - A **page registry** — the pages a feature can name, so a step reads
 *   `Given I open the checkout page` and gets a `CheckoutPage`, typed.
 * - A **`{page}` parameter type** built from the registry, so a feature naming
 *   an unknown page fails at step matching, where the typo is, rather than deep
 *   inside a step.
 *
 * Step bodies stay hand-written: the feature's wording is the team's, not a
 * mirror of method names.
 */

/** Anything a page registry can construct: a page or component harness class. */
export type PageConstructor<T = object> = new (env: EnvConfig) => T

export type PageMap = Record<string, PageConstructor>

/** The pages a feature can name. */
export interface PageRegistry<P extends PageMap> {
  /** Every registered name, longest first — the order a matcher must try them. */
  readonly names: ReadonlyArray<keyof P & string>
  /** Whether `name` is registered: narrows a string from a step to a page name. */
  has(name: string): name is keyof P & string
  /** Constructs the named page with the scenario's env. */
  open<N extends keyof P & string>(name: N, env: EnvConfig): InstanceType<P[N]>
}

export function definePages<P extends PageMap>(pages: P): PageRegistry<P> {
  const names = (Object.keys(pages) as Array<keyof P & string>).sort((a, b) => b.length - a.length)
  return {
    names,
    has(name: string): name is keyof P & string {
      return Object.prototype.hasOwnProperty.call(pages, name)
    },
    open(name, env) {
      const Page = pages[name]
      if (Page === undefined) {
        throw new Error(`harnessed: no page named "${name}". Registered: ${names.join(', ')}.`)
      }
      return new Page(env) as InstanceType<P[typeof name]>
    },
  }
}

/**
 * A cucumber-expression parameter type, in the shape every runner's
 * `defineParameterType` takes: @cucumber/cucumber, playwright-bdd and
 * @badeball/cypress-cucumber-preprocessor alike.
 */
export interface ParameterTypeDefinition<T> {
  name: string
  regexp: RegExp
  transformer: (match: string) => T
  useForSnippets?: boolean
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `{page}` for step patterns: matches exactly the registered names (longest
 * first, so `checkout summary` wins over `checkout`) and hands the step the
 * name, typed. Name it something else with `{ name }`.
 *
 * ```ts
 * defineParameterType(pageParameter(pages))
 * Given('I open the {page} page', async function (name) { … pages.open(name, env) })
 * ```
 */
export function pageParameter<P extends PageMap>(
  registry: PageRegistry<P>,
  options: { name?: string } = {},
): ParameterTypeDefinition<keyof P & string> {
  return {
    name: options.name ?? 'page',
    regexp: new RegExp(registry.names.map(escape).join('|')),
    transformer: match => {
      // The regexp only admits registered names, so this cannot fail; it is
      // here so a hand-built pattern that bypasses it still gets a clear error.
      if (!registry.has(match)) throw new Error(`harnessed: no page named "${match}".`)
      return match
    },
    useForSnippets: false,
  }
}

/**
 * A fresh, empty world. Adapters call this once per scenario; it exists so the
 * bag's type is written once, where the steps declare it.
 */
export function createWorld<W>(): Partial<W> {
  return {}
}
