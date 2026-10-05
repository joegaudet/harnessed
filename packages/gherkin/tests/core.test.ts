import {
  CucumberExpression,
  ParameterType,
  ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions'
import type { EnvConfig } from '@harnessed-ts/core'
import { describe, expect, it } from 'vitest'
import { createWorld, definePages, pageParameter } from '../src/index'

class Checkout {
  constructor(readonly env: EnvConfig) {}
}
class CheckoutSummary {
  constructor(readonly env: EnvConfig) {}
}
class Wizard {
  constructor(readonly env: EnvConfig) {}
}

const pages = definePages({
  checkout: Checkout,
  'checkout summary': CheckoutSummary,
  'wizard (beta)': Wizard,
})
const env: EnvConfig = { driver: 'test' }

describe('@harnessed-ts/gherkin', () => {
  it('opens a registered page with the scenario env, typed', () => {
    const page = pages.open('checkout summary', env)
    expect(page).toBeInstanceOf(CheckoutSummary)
    expect(page.env).toBe(env)
  })

  it('refuses an unknown page by name, listing the registered ones', () => {
    expect(() => pages.open('nope' as 'checkout', env)).toThrow(
      /no page named "nope". Registered: checkout summary, wizard \(beta\), checkout/,
    )
  })

  it('refuses a name the registry only inherits, like constructor', () => {
    expect(pages.has('constructor')).toBe(false)
    expect(() => pages.open('constructor' as 'checkout', env)).toThrow(
      /no page named "constructor"/,
    )
  })

  it('refuses an empty registry, whose {page} would match the empty string', () => {
    expect(() => definePages({})).toThrow(/at least one page/)
  })

  it('matches exactly the registered names, longest first', () => {
    const { regexp } = pageParameter(pages)
    const whole = new RegExp(`^(?:${regexp.source})$`)
    expect('checkout summary'.match(regexp)?.[0]).toBe('checkout summary')
    expect(whole.test('wizard (beta)')).toBe(true)
    // An unknown name does not match, so the step is undefined — the typo is
    // reported where it is, in the feature file.
    expect(whole.test('checkuot')).toBe(false)
  })

  it('rejects an unknown page in a real cucumber expression, and hands back a known one', () => {
    const { name, regexp, transformer, useForSnippets } = pageParameter(pages)
    const registry = new ParameterTypeRegistry()
    registry.defineParameterType(
      new ParameterType(name, regexp, null, transformer, useForSnippets, false),
    )
    const expression = new CucumberExpression('I open the {page} page', registry)

    const known = expression.match('I open the checkout summary page')
    expect(known?.map(argument => argument.getValue(null))).toEqual(['checkout summary'])
    expect(expression.match('I open the wizard (beta) page')?.[0]?.getValue(null)).toBe(
      'wizard (beta)',
    )
    // The step does not match, so the runner reports it undefined at the typo.
    expect(expression.match('I open the checkuot page')).toBeNull()
    expect(expression.match('I open the  page')).toBeNull()
  })

  it('names the parameter type {page} unless told otherwise', () => {
    expect(pageParameter(pages).name).toBe('page')
    expect(pageParameter(pages, { name: 'screen' }).name).toBe('screen')
  })

  it('a world starts empty and belongs to whoever created it', () => {
    const first = createWorld<{ note: string }>()
    const second = createWorld<{ note: string }>()
    first.note = 'kept'
    expect(second).toEqual({})
  })
})
