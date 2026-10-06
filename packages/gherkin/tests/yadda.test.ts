import { readFileSync } from 'node:fs'
import type { EnvConfig } from '@harnessed-ts/core'
import { describe, expect, it } from 'vitest'
import Yadda from 'yadda'
import { definePages } from '../src/index'
import { pageDictionary, yaddaWorld } from '../src/yadda'

// Stand-ins for the conformance wizard: enough shape for the shared feature's
// steps, with no browser behind them.
class StepTwo {
  async heading(): Promise<string> {
    return 'Step two'
  }
}
class StepOne {
  async heading(): Promise<string> {
    return 'Step one'
  }
  async continue(): Promise<StepTwo> {
    return new StepTwo()
  }
}
class Wizard {
  visited = false
  readonly stepOne = new StepOne()
  constructor(readonly env: EnvConfig) {}
  async goto(): Promise<void> {
    this.visited = true
  }
}
class WizardSummary {
  constructor(readonly env: EnvConfig) {}
}

const pages = definePages({ wizard: Wizard, 'wizard summary': WizardSummary })
const env: EnvConfig = { driver: 'test' }

interface World {
  wizard: Wizard
  step: StepOne | StepTwo
}

function run(library: Yadda.BaseLibrary, steps: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    Yadda.createInstance(library).run(steps, {}, err => (err ? reject(err) : resolve()))
  })
}

/** The shared feature's steps, written the way an app's steps module would. */
function steps(seen: Array<Partial<World>> = []) {
  return yaddaWorld<World>()
    .steps({ pages, env: () => env })
    .step('the world is empty', ({ world }) => {
      seen.push(world)
      expect(world).toEqual({})
    })
    .when('I open the $page page', async ({ world, open }, name: 'wizard') => {
      const wizard = open(name)
      await wizard.goto()
      world.wizard = wizard
      world.step = wizard.stepOne
    })
    .then('the wizard shows "$heading"', async ({ world }, heading: string) => {
      expect(await world.wizard?.stepOne.heading()).toBe(heading)
    })
    .when('I continue from step one', async ({ world }) => {
      world.step = await world.wizard?.stepOne.continue()
    })
    .then('the current step shows "$heading"', async ({ world }, heading: string) => {
      expect(await world.step?.heading()).toBe(heading)
    })
}

describe('@harnessed-ts/gherkin/yadda', () => {
  const feature = new Yadda.parsers.FeatureParser().parse(
    readFileSync(new URL('../features/harness-world.feature', import.meta.url), 'utf8'),
  )

  it('runs every scenario of the shared feature, a fresh world each, in either order', async () => {
    // Every scenario checks its world starts empty and then fills it, so the
    // check holds whichever order a runner (ember-exam --random) picks.
    expect(feature.scenarios).toHaveLength(2)
    for (const order of [feature.scenarios, [...feature.scenarios].reverse()]) {
      const seen: Array<Partial<World>> = []
      for (const scenario of order) {
        // A library per scenario, the way ember-cli-yadda builds one per test.
        await run(steps(seen).library, scenario.steps)
      }
      expect(seen).toHaveLength(2)
      expect(seen[0]).not.toBe(seen[1])
    }
  })

  it('keeps one world across the steps of a scenario', async () => {
    const library = steps()
    await run(library.library, ['When I open the wizard page'])
    expect(library.world.wizard).toBeInstanceOf(Wizard)
    expect(library.world.wizard?.visited).toBe(true)
    expect(library.world.wizard?.env).toBe(env)
  })

  it('matches a keyword-agnostic step under any keyword, and only at the start', async () => {
    await run(steps().library, ['Given the world is empty', 'Then the world is empty'])
    await run(steps().library, ['And the world is empty', 'But the world is empty'])
    await expect(run(steps().library, ['Given not quite the world is empty'])).rejects.toThrow(
      /Undefined Step/,
    )
  })

  it('leaves an unknown page undefined, so the typo fails at matching', async () => {
    await expect(run(steps().library, ['When I open the wizrd page'])).rejects.toThrow(
      /Undefined Step/,
    )
  })

  it('reports a failing step', async () => {
    await expect(
      run(steps().library, ['When I open the wizard page', 'Then the wizard shows "Step nine"']),
    ).rejects.toThrow(/Step nine/)
  })

  it('$page matches the registered names, longest first, through the converter', async () => {
    const opened: string[] = []
    const library = yaddaWorld()
      .steps({ pages, env: () => env })
      .when('I open the $page page', ({ open }, name: 'wizard' | 'wizard summary') => {
        opened.push(name)
        open(name)
      })
    await run(library.library, [
      'When I open the wizard summary page',
      'When I open the wizard page',
    ])
    expect(opened).toEqual(['wizard summary', 'wizard'])
  })

  it('names the term $page unless told otherwise, and extends a given dictionary', async () => {
    const dictionary = pageDictionary(pages, {
      term: 'screen',
      dictionary: new Yadda.Dictionary().define('count', /(\d+)/),
    })
    const seen: unknown[] = []
    const library = yaddaWorld()
      .steps({ pages, env: () => env, dictionary })
      .given('$count visits to the $screen screen', (_scenario, count: string, name: string) => {
        seen.push(count, name)
      })
    await run(library.library, ['Given 2 visits to the wizard screen'])
    expect(seen).toEqual(['2', 'wizard'])
  })

  it('extends the same dictionary twice without a duplicate term', async () => {
    // ember-cli-yadda calls a steps module's default export once per scenario,
    // so a module-level dictionary is extended again in every scenario after
    // the first.
    const base = new Yadda.Dictionary().define('count', /(\d+)/)
    const first = pageDictionary(pages, { dictionary: base })
    const again = pageDictionary(pages, { dictionary: base })
    expect(first).toBe(base)
    expect(again).toBe(base)
    for (const dictionary of [first, again]) {
      const opened: string[] = []
      const library = yaddaWorld()
        .steps({ pages, env: () => env, dictionary })
        .given('$count visits to the $page page', (_scenario, count: string, name: string) => {
          opened.push(count, name)
        })
      await run(library.library, ['Given 3 visits to the wizard summary page'])
      expect(opened).toEqual(['3', 'wizard summary'])
    }
    // A different term is a different extension, not a duplicate.
    expect(() => pageDictionary(pages, { dictionary: base, term: 'screen' })).not.toThrow()
    // The same term over different pages is a mistake, and says so.
    expect(() => pageDictionary(definePages({ wizard: Wizard }), { dictionary: base })).toThrow(
      /already defines \$page/,
    )
  })

  it('converts $page with a callback converter, so a transpiled build counts its captures', async () => {
    const [converter] = pageDictionary(pages).expand('$page').converters
    // Yadda tells an async converter by its constructor's name, which a
    // transpiler that rewrites async functions changes; a callback converter's
    // captures are its arity less one, however it was compiled.
    expect(converter?.constructor.name).not.toBe('AsyncFunction')
    expect(converter).toHaveLength(2)
    const converted = await new Promise((resolve, reject) => {
      ;(converter as (match: string, done: Yadda.ConverterCallback) => void)(
        'wizard summary',
        (err, value) => (err ? reject(err) : resolve(value)),
      )
    })
    expect(converted).toBe('wizard summary')
    const refused = await new Promise(resolve => {
      ;(converter as (match: string, done: Yadda.ConverterCallback) => void)('wizrd', resolve)
    })
    expect(String(refused)).toMatch(/no page named "wizrd"/)
  })

  it('gives each scenario its own world from one module-level yaddaWorld()', async () => {
    // The documented shape: one yaddaWorld() at module level, steps() inside
    // the default export ember-cli-yadda calls once per scenario.
    const moduleWorld = yaddaWorld<World>()
    const steps = (seen: Array<Partial<World>>) =>
      moduleWorld
        .steps({ pages, env: () => env })
        .step('the world is empty', ({ world }) => {
          seen.push(world)
          expect(world).toEqual({})
        })
        .when('I open the $page page', async ({ world, open }, name: 'wizard') => {
          world.wizard = open(name)
        })
    const seen: Array<Partial<World>> = []
    await run(steps(seen).library, ['Given the world is empty', 'When I open the wizard page'])
    await run(steps(seen).library, ['Given the world is empty', 'When I open the wizard page'])
    expect(seen).toHaveLength(2)
    expect(seen[0]).not.toBe(seen[1])
    expect(seen[0]?.wizard).toBeInstanceOf(Wizard)
    expect(seen[1]?.wizard).toBeInstanceOf(Wizard)
    expect(seen[0]?.wizard).not.toBe(seen[1]?.wizard)
  })

  it('hands steps the Yadda context, so a runner can pass things through', async () => {
    const steps: string[] = []
    const library = yaddaWorld()
      .steps({ pages, env: () => env })
      .step('a step', ({ context }) => {
        steps.push(String(context.step))
      })
    await run(library.library, ['Given a step'])
    expect(steps).toEqual(['Given a step'])
  })
})
