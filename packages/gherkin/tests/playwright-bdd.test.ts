import { test as playwrightTest } from '@playwright/test'
import { describe, expect, it } from 'vitest'
import { withWorld } from '../src/playwright-bdd'

interface World {
  note: string
}

type WorldFixtureFn = (args: object, use: (value: Partial<World>) => Promise<void>) => Promise<void>

/**
 * Stands in for a Playwright `test`: records what `extend` was given, so the
 * fixture can be run the way the runner would run it, once per test.
 */
function fakeTest() {
  const extensions: Array<Record<string, unknown>> = []
  const extended = { extended: true }
  return {
    base: {
      extend(fixtures: Record<string, unknown>) {
        extensions.push(fixtures)
        return extended
      },
    },
    extended,
    extensions,
  }
}

/** Runs the world fixture as Playwright would for one test, and returns what the test saw. */
async function runFixture(fixture: WorldFixtureFn): Promise<Partial<World>> {
  let seen: Partial<World> | undefined
  await fixture({}, async world => {
    seen = world
  })
  if (seen === undefined) throw new Error('the fixture never handed the test a world')
  return seen
}

describe('@harnessed-ts/gherkin/playwright-bdd', () => {
  it('extends the base test with a world fixture and returns what extend returns', () => {
    const { base, extended, extensions } = fakeTest()
    expect(withWorld<World, typeof base>(base)).toBe(extended)
    expect(extensions).toHaveLength(1)
    expect(Object.keys(extensions[0] ?? {})).toEqual(['world'])
  })

  it('hands every test its own empty world', async () => {
    const { base, extensions } = fakeTest()
    withWorld<World, typeof base>(base)
    const fixture = extensions[0]?.world as WorldFixtureFn

    const first = await runFixture(fixture)
    expect(first).toEqual({})
    first.note = 'kept'
    const second = await runFixture(fixture)
    expect(second).toEqual({})
    expect(second).not.toBe(first)
  })

  it("extends Playwright's own test", () => {
    const test = withWorld<World, typeof playwrightTest>(playwrightTest)
    expect(typeof test.extend).toBe('function')
    expect(test).not.toBe(playwrightTest)
  })
})
