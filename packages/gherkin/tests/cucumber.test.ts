import type { IWorldOptions } from '@cucumber/cucumber'
import type { EnvConfig } from '@harnessed-ts/core'
import { describe, expect, it } from 'vitest'
import { HarnessedWorld } from '../src/cucumber'
import { definePages } from '../src/index'

class Checkout {
  constructor(readonly env: EnvConfig) {}
}

const pageMap = { checkout: Checkout }
const pages = definePages(pageMap)
const env: EnvConfig = { driver: 'test' }

/** What cucumber hands a world's constructor; nothing here reads it. */
const options: IWorldOptions = {
  attach: async () => undefined,
  log: async () => undefined,
  link: async () => undefined,
  parameters: {},
}

class AppWorld extends HarnessedWorld<{ checkout: Checkout }, typeof pageMap> {
  override pages = pages
}

describe('@harnessed-ts/gherkin/cucumber', () => {
  it('opens a registered page with the scenario env, typed', () => {
    const world = new AppWorld(options)
    world.env = env
    const checkout = world.open('checkout')
    expect(checkout).toBeInstanceOf(Checkout)
    expect(checkout.env).toBe(env)
  })

  it('starts each world with its own empty bag', () => {
    const first = new AppWorld(options)
    first.env = env
    first.bag.checkout = first.open('checkout')
    expect(new AppWorld(options).bag).toEqual({})
  })

  it('says to assign the registry when a world has none', () => {
    const world = new HarnessedWorld<{ checkout: Checkout }, typeof pageMap>(options)
    world.env = env
    expect(() => world.open('checkout')).toThrow(/no page registry/)
  })

  it('says to set the env in a Before hook when a world has none', () => {
    expect(() => new AppWorld(options).open('checkout')).toThrow(/no env yet/)
  })
})
