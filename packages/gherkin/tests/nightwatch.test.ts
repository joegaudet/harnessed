import type { Before, IWorldOptions } from '@cucumber/cucumber'
import type { EnvConfig } from '@harnessed-ts/core'
import type { NightwatchAPI } from 'nightwatch'
import { afterEach, describe, expect, it } from 'vitest'
import { definePages } from '../src/index'
import { HarnessedWorld, nightwatchEnv } from '../src/nightwatch'
import type { NightwatchWorld } from '../src/nightwatch'

class Checkout {
  constructor(readonly env: EnvConfig) {}
}

const pageMap = { checkout: Checkout }

/** What cucumber hands a world's constructor; nothing here reads it. */
const options: IWorldOptions = {
  attach: async () => undefined,
  log: async () => undefined,
  link: async () => undefined,
  parameters: {},
}

class AppWorld extends HarnessedWorld<{ checkout: Checkout }, typeof pageMap> {
  override pages = definePages(pageMap)
  browser?: NightwatchAPI
}

/** Stands in for the browser Nightwatch launches; the env only carries it. */
const launched = { sessionId: 'a-session' } as object as NightwatchAPI

describe('@harnessed-ts/gherkin/nightwatch', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'browser')
  })

  it("builds the scenario's env from the browser Nightwatch set on the world", () => {
    const world = new AppWorld(options)
    world.browser = launched
    nightwatchEnv.call(world)
    expect(world.env).toEqual({ driver: 'nightwatch', browser: launched })
    expect(world.open('checkout').env).toBe(world.env)
  })

  it('falls back to the global browser when the world has none', () => {
    Reflect.set(globalThis, 'browser', launched)
    const world: NightwatchWorld = new AppWorld(options)
    nightwatchEnv.call(world)
    expect(world.env).toMatchObject({ driver: 'nightwatch', browser: launched })
  })

  it('says how to get a browser when Nightwatch started none', () => {
    expect(() => nightwatchEnv.call(new AppWorld(options))).toThrow(
      /has not started a browser for this scenario.*auto_start_session/,
    )
  })

  it('is a Before hook for any HarnessedWorld, whatever its pages', () => {
    // Checked by the compiler: cucumber's own Before takes it for a world subclass.
    const register = (before: typeof Before) => before<AppWorld>(nightwatchEnv)
    expect(register).toBeTypeOf('function')
  })

  it('re-exports the cucumber-js world, so one import serves the step file', async () => {
    const cucumber = await import('../src/cucumber')
    expect(HarnessedWorld).toBe(cucumber.HarnessedWorld)
  })
})
