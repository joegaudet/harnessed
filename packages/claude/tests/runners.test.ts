import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectRunners } from '../src/detect'
import { install } from '../src/install'
import { runnersSection } from '../src/render'
import { pkg, removeRepos, repo } from './repo'

/**
 * The skill tells an agent how to build an env and assert in *this* repo's
 * runners, so it has to know which runners the repo uses: from its
 * dependencies, and from the config files each runner leaves behind.
 */
afterEach(removeRepos)

describe('detectRunners', () => {
  it('reads the runners from devDependencies', () => {
    const root = repo({
      'package.json': pkg({
        'ember-source': '^7.3.0',
        'ember-qunit': '^9.0.0',
        cypress: '^16.0.0',
        '@wdio/cli': '^10.0.0',
        testcafe: '^3.0.0',
        puppeteer: '^25.0.0',
        '@playwright/test': '^1.62.0',
        '@vitest/browser-playwright': '5.0.0',
        '@testing-library/dom': '^10.0.0',
        'playwright-bdd': '^9.0.0',
      }),
    })
    expect(detectRunners(root)).toEqual([
      'ember',
      'cypress',
      'webdriverio',
      'testcafe',
      'puppeteer',
      'playwright',
      'vitest-browser',
      'testing-library',
      'gherkin',
    ])
  })

  it('also recognises a runner by the config file it leaves behind', () => {
    const root = repo({
      'package.json': pkg({}),
      'ember-cli-build.js': '',
      'cypress.config.ts': '',
      'wdio.conf.ts': '',
      '.testcaferc.json': '{}',
    })
    expect(detectRunners(root)).toEqual(['ember', 'cypress', 'webdriverio', 'testcafe'])
  })

  it('is empty for a repo with none, rather than guessing', () => {
    expect(detectRunners(repo({ 'package.json': pkg({ react: '^19.0.0' }) }))).toEqual([])
  })
})

describe('the generated runners section', () => {
  it('shows, per runner, how to build the env and how to assert', () => {
    const section = runnersSection(['ember', 'cypress'])
    expect(section).toMatch(/@harnessed-ts\/ember/)
    expect(section).toMatch(/ember\(\)/)
    expect(section).toMatch(/assert\.harness/)
    expect(section).toMatch(/cy\.harness/)
    expect(section).not.toMatch(/webdriverio/i)
  })

  it('says so when no runner was detected', () => {
    expect(runnersSection([])).toMatch(/No test runner was detected/)
  })
})

describe('install', () => {
  it('writes the runners section into the skill and an example per runner', () => {
    const root = repo({ 'package.json': pkg({ 'ember-source': '^7.3.0', cypress: '^16.0.0' }) })
    const result = install({ root })
    const skill = readFileSync(join(root, '.claude/skills/harness/SKILL.md'), 'utf8')
    expect(skill).toMatch(/cy\.harness/)
    expect(skill).toMatch(/assert\.harness/)
    expect(result.runners).toEqual(['ember', 'cypress'])
    for (const example of ['ember.test-example.ts', 'cypress.test-example.ts']) {
      expect(result.written).toContain(join(root, '.claude/skills/harness/examples', example))
    }
    expect(result.written.some(path => path.includes('webdriverio'))).toBe(false)
  })
})
