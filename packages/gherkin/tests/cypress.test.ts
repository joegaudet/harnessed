import { afterEach, describe, expect, it, vi } from 'vitest'
import { cypressWorld } from '../src/cypress'

interface World {
  note: string
}

/** Stands in for Mocha's `beforeEach`: collects the hooks, runs them on demand. */
function hooks() {
  const registered: Array<() => void> = []
  return {
    beforeEach: (fn: () => void) => {
      registered.push(fn)
    },
    startScenario: () => registered.forEach(fn => fn()),
    count: () => registered.length,
  }
}

describe('@harnessed-ts/gherkin/cypress', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers one beforeEach, and the world starts empty in each scenario', () => {
    const runner = hooks()
    const { world } = cypressWorld<World>({ beforeEach: runner.beforeEach })
    expect(runner.count()).toBe(1)

    runner.startScenario()
    expect(world()).toEqual({})
    world().note = 'kept across steps'
    expect(world().note).toBe('kept across steps')

    runner.startScenario()
    expect(world()).toEqual({})
  })

  it('refuses to hand out a world before a scenario has started', () => {
    const { world } = cypressWorld<World>({ beforeEach: hooks().beforeEach })
    expect(() => world()).toThrow(/no scenario is running/)
  })

  it("registers with the runner's global beforeEach by default", () => {
    const runner = hooks()
    vi.stubGlobal('beforeEach', runner.beforeEach)
    const { world } = cypressWorld<World>()
    runner.startScenario()
    expect(world()).toEqual({})
  })

  it('says where to call it when there is no global beforeEach', () => {
    expect(() => cypressWorld<World>()).toThrow(/no global beforeEach/)
  })
})
