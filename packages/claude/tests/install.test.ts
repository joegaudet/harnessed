import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { install } from '../src/install'
import type { InstallOptions } from '../src/install'
import { pkg, removeRepos, repo } from './repo'

afterEach(removeRepos)

const examples = (root: string): string => join(root, '.claude/skills/harness/examples')
const example = (root: string, name: string): string => join(examples(root), name)
const read = (path: string): string => readFileSync(path, 'utf8')

describe('install: re-running', () => {
  it('removes the example of a runner the repo no longer uses', () => {
    const root = repo({ 'package.json': pkg({ 'ember-source': '^7.3.0', cypress: '^16.0.0' }) })
    install({ root })
    expect(existsSync(example(root, 'cypress.test-example.ts'))).toBe(true)

    writeFileSync(join(root, 'package.json'), pkg({ 'ember-source': '^7.3.0' }))
    const result = install({ root })

    expect(existsSync(example(root, 'cypress.test-example.ts'))).toBe(false)
    expect(result.removed).toContain(example(root, 'cypress.test-example.ts'))
    expect(existsSync(example(root, 'ember.test-example.ts'))).toBe(true)
    expect(result.removed).not.toContain(example(root, 'ember.test-example.ts'))
  })

  it('removes a Gherkin example for an adapter the repo no longer uses', () => {
    const root = repo({ 'package.json': pkg({ 'playwright-bdd': '*' }) })
    install({ root })
    writeFileSync(join(root, 'package.json'), pkg({ '@cucumber/cucumber': '*' }))
    const result = install({ root })

    expect(result.removed).toContain(example(root, 'gherkin-playwright-bdd.test-example.ts'))
    expect(existsSync(example(root, 'gherkin-playwright-bdd.test-example.ts'))).toBe(false)
    expect(existsSync(example(root, 'gherkin-cucumber.test-example.ts'))).toBe(true)
  })

  it('in a dry run, reports the stale example without deleting it', () => {
    const root = repo({ 'package.json': pkg({ cypress: '^16.0.0' }) })
    install({ root })
    writeFileSync(join(root, 'package.json'), pkg({}))
    const result = install({ root, dryRun: true })

    expect(result.removed).toContain(example(root, 'cypress.test-example.ts'))
    expect(existsSync(example(root, 'cypress.test-example.ts'))).toBe(true)
  })
})

describe('install: dry run', () => {
  it('lists the per-runner examples it would write, and writes nothing', () => {
    const root = repo({ 'package.json': pkg({ testcafe: '^3.0.0' }) })
    const result = install({ root, dryRun: true })

    expect(result.runners).toEqual(['testcafe'])
    expect(result.written).toContain(example(root, 'testcafe.test-example.ts'))
    expect(existsSync(join(root, '.claude'))).toBe(false)
    expect(existsSync(join(root, 'harnessed.config.ts'))).toBe(false)
  })
})

describe('install: choosing the runners explicitly', () => {
  it('documents the runners it is given instead of the detected ones', () => {
    const root = repo({ 'package.json': pkg({ cypress: '^16.0.0' }) })
    const result = install({ root, layout: { runners: ['webdriverio'] } })

    expect(result.runners).toEqual(['webdriverio'])
    expect(existsSync(example(root, 'webdriverio.test-example.ts'))).toBe(true)
    expect(existsSync(example(root, 'cypress.test-example.ts'))).toBe(false)
  })

  it('refuses an unknown runner with a message naming it, rather than crashing', () => {
    const root = repo({ 'package.json': pkg({}) })
    // What a JavaScript caller, or a config read at runtime, can hand over.
    const layout = JSON.parse('{ "runners": ["mocha"] }') as InstallOptions['layout']
    expect(() => install({ root, layout })).toThrow(/unknown runner "mocha"/)
    expect(existsSync(join(root, '.claude'))).toBe(false)
  })

  it('writes every Gherkin example when gherkin is chosen but no adapter is installed', () => {
    const root = repo({ 'package.json': pkg({}) })
    install({ root, layout: { runners: ['gherkin'] } })
    for (const adapter of ['playwright-bdd', 'cucumber', 'cypress', 'yadda']) {
      expect(existsSync(example(root, `gherkin-${adapter}.test-example.ts`)), adapter).toBe(true)
    }
  })
})

describe('install: the examples it writes', () => {
  it('picks the Gherkin example by the adapter package the repo uses', () => {
    const cases = [
      ['@cucumber/cucumber', 'cucumber', /HarnessedWorld/, '@harnessed-ts/gherkin/cucumber'],
      [
        '@badeball/cypress-cucumber-preprocessor',
        'cypress',
        /cypressWorld/,
        '@harnessed-ts/gherkin/cypress',
      ],
      ['ember-cli-yadda', 'yadda', /yaddaWorld/, '@harnessed-ts/gherkin/yadda'],
      ['playwright-bdd', 'playwright-bdd', /withWorld/, '@harnessed-ts/gherkin/playwright-bdd'],
    ] as const
    for (const [dependency, adapter, api, entry] of cases) {
      const root = repo({ 'package.json': pkg({ [dependency]: '*' }) })
      const result = install({ root })
      const path = example(root, `gherkin-${adapter}.test-example.ts`)
      expect(result.written, dependency).toContain(path)
      expect(read(path), dependency).toMatch(api)
      expect(read(path), dependency).toContain(`'${entry}'`)
      const others = result.written.filter(
        written => written.includes('gherkin-') && written !== path,
      )
      expect(others, dependency).toEqual([])
    }
  })

  it('shows the Cypress support import that registers cy.harness and cy.visitPage', () => {
    const root = repo({ 'package.json': pkg({ cypress: '^16.0.0' }) })
    install({ root })
    expect(read(example(root, 'cypress.test-example.ts'))).toContain(
      "import '@harnessed-ts/cypress/support'",
    )
  })

  it('renders components as elements, never by calling them', () => {
    const root = repo({
      'package.json': pkg({ '@testing-library/react': '*', '@vitest/browser': '*' }),
    })
    install({ root })
    for (const name of ['testing-library.test-example.ts', 'vitest-browser.test-example.ts']) {
      const contents = read(example(root, name))
      expect(contents, name).not.toMatch(/render\(Checkout\(/)
      expect(contents, name).toContain("createElement(Checkout, { token: 'abc' })")
    }
  })

  it('declares the Puppeteer page it drives', () => {
    const root = repo({ 'package.json': pkg({ puppeteer: '^25.0.0' }) })
    install({ root })
    const contents = read(example(root, 'puppeteer.test-example.ts'))
    expect(contents).toMatch(/beforeAll\(/)
    expect(contents).toMatch(/page = await browser\.newPage\(\)/)
  })
})

describe('install: the skill', () => {
  it('names the worked examples it wrote', () => {
    const root = repo({ 'package.json': pkg({ cypress: '^16.0.0', 'ember-cli-yadda': '*' }) })
    install({ root })
    const skill = read(join(root, '.claude/skills/harness/SKILL.md'))
    expect(skill).toContain('`examples/cypress.test-example.ts`')
    expect(skill).toContain('`examples/gherkin-yadda.test-example.ts`')
  })

  it('promises no worked examples when it detected no runner', () => {
    const root = repo({ 'package.json': pkg({}) })
    install({ root })
    const skill = read(join(root, '.claude/skills/harness/SKILL.md'))
    expect(skill).toMatch(/No test runner was detected/)
    expect(skill).not.toMatch(/worked example/i)
  })
})

describe('install: speaking in behaviours', () => {
  it('writes the harness rule, scoped to the harness directory', () => {
    const root = repo({ 'package.json': pkg({}) })
    install({ root, layout: { harnesses: 'lib/harnesses' } })
    expect(read(join(root, '.claude/rules/harness.md'))).toMatch(
      /^---\npaths: \['lib\/harnesses\/\*\*'\]/,
    )
  })

  it('tells harness authors to speak in behaviours, with the portability test', () => {
    const root = repo({ 'package.json': pkg({}) })
    install({ root })
    const rules = read(join(root, '.claude/rules/harness.md'))
    expect(rules).toContain('### Speak in behaviours')
    expect(rules).toContain('if this app were rebuilt natively')
  })

  it('mirrors the principle in the skill', () => {
    const root = repo({ 'package.json': pkg({}) })
    install({ root })
    const skill = read(join(root, '.claude/skills/harness/SKILL.md'))
    expect(skill).toContain('## Speak in behaviours')
    expect(skill).toContain('if this app were rebuilt natively')
  })

  it('writes a test rule, scoped to the files every runner treats as tests', () => {
    const root = repo({ 'package.json': pkg({}) })
    const result = install({ root })
    const path = join(root, '.claude/rules/harness-tests.md')
    expect(result.written).toContain(path)

    const rules = read(path)
    const frontmatter = rules.slice(0, rules.indexOf('\n---', 4))
    for (const glob of ['**/*.spec.*', '**/*.test.*', '**/*.cy.*', '**/*.steps.*', '**/steps/**']) {
      expect(frontmatter).toContain(`'${glob}'`)
    }
    expect(rules).toContain('only their public methods')
  })

  it('reports the test rule in a dry run without writing it', () => {
    const root = repo({ 'package.json': pkg({}) })
    const result = install({ root, dryRun: true })
    const path = join(root, '.claude/rules/harness-tests.md')
    expect(result.written).toContain(path)
    expect(existsSync(path)).toBe(false)
  })
})
