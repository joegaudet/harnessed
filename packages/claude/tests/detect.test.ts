import { afterEach, describe, expect, it } from 'vitest'
import {
  detectEmberUnderVitest,
  detectGherkinAdapters,
  detectRunners,
  parseRunners,
  toRunners,
} from '../src/detect'
import { pkg, removeRepos, repo } from './repo'

afterEach(removeRepos)

describe('detectRunners: which manifest fields count', () => {
  it('reads dependencies as well as devDependencies', () => {
    const root = repo({
      'package.json': JSON.stringify({ name: 'app', dependencies: { cypress: '^16.0.0' } }),
    })
    expect(detectRunners(root)).toEqual(['cypress'])
  })

  it('reads peer and optional dependencies too', () => {
    const root = repo({
      'package.json': JSON.stringify({
        name: 'app',
        peerDependencies: { '@playwright/test': '^1.62.0' },
        optionalDependencies: { puppeteer: '^25.0.0' },
      }),
    })
    expect(detectRunners(root)).toEqual(['puppeteer', 'playwright'])
  })

  it('falls back to config files when there is no manifest', () => {
    expect(detectRunners(repo({ 'cypress.config.ts': '' }))).toEqual(['cypress'])
  })

  it('falls back to config files when the manifest is not valid JSON', () => {
    const root = repo({ 'package.json': '{ not json', 'wdio.conf.ts': '' })
    expect(detectRunners(root)).toEqual(['webdriverio'])
  })

  it('recognises every Testing Library flavour', () => {
    for (const flavour of ['angular', 'preact', 'ember', 'react', 'vue', 'svelte', 'dom']) {
      const root = repo({ 'package.json': pkg({ [`@testing-library/${flavour}`]: '*' }) })
      expect(detectRunners(root), flavour).toEqual(['testing-library'])
    }
  })
})

describe('detectRunners: monorepos', () => {
  it('reads the packages an npm/yarn `workspaces` array names', () => {
    const root = repo({
      'package.json': JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*'] }),
      'apps/web/package.json': pkg({ cypress: '^16.0.0' }),
      'apps/admin/package.json': pkg({ '@playwright/test': '^1.62.0' }),
    })
    expect(detectRunners(root)).toEqual(['cypress', 'playwright'])
  })

  it('reads the object form of `workspaces`', () => {
    const root = repo({
      'package.json': JSON.stringify({ name: 'root', workspaces: { packages: ['packages/**'] } }),
      'packages/ui/deep/package.json': pkg({ '@vitest/browser': '5.0.0' }),
    })
    expect(detectRunners(root)).toEqual(['vitest-browser'])
  })

  it('reads the packages pnpm-workspace.yaml names', () => {
    const root = repo({
      'package.json': pkg({ prettier: '^3.0.0' }),
      'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - \"tools/e2e\"\n  - '!apps/legacy'\n",
      'apps/web/package.json': pkg({ cypress: '^16.0.0' }),
      'apps/legacy/package.json': pkg({ testcafe: '^3.0.0' }),
      'tools/e2e/package.json': pkg({ puppeteer: '^25.0.0' }),
    })
    expect(detectRunners(root)).toEqual(['cypress', 'puppeteer'])
  })

  it('reads a pnpm-workspace.yaml whose list items start at column 0', () => {
    const root = repo({
      'package.json': pkg({ prettier: '^3.0.0' }),
      'pnpm-workspace.yaml':
        "packages:\n- 'apps/*'\n- tools/e2e # the e2e suite\n- '!apps/legacy'\nonlyBuiltDependencies:\n- esbuild\n",
      'apps/web/package.json': pkg({ cypress: '^16.0.0' }),
      'apps/legacy/package.json': pkg({ testcafe: '^3.0.0' }),
      'tools/e2e/package.json': pkg({ puppeteer: '^25.0.0' }),
      'esbuild/package.json': pkg({ playwright: '^1.0.0' }),
    })
    expect(detectRunners(root)).toEqual(['cypress', 'puppeteer'])
  })

  it('without a workspace config, scans packages one and two levels down', () => {
    const root = repo({
      'package.json': pkg({ prettier: '^3.0.0' }),
      'web/package.json': pkg({ cypress: '^16.0.0' }),
      'apps/admin/package.json': pkg({ 'ember-source': '^7.3.0' }),
    })
    expect(detectRunners(root)).toEqual(['ember', 'cypress'])
  })

  it('never reads installed packages under node_modules', () => {
    const root = repo({
      'package.json': pkg({}),
      'node_modules/cypress/package.json': pkg({ cypress: '^16.0.0' }),
      'node_modules/@scope/thing/package.json': pkg({ testcafe: '^3.0.0' }),
    })
    expect(detectRunners(root)).toEqual([])
  })

  it("recognises a runner's config file inside a workspace package", () => {
    const root = repo({
      'package.json': JSON.stringify({ name: 'root', workspaces: ['apps/*'] }),
      'apps/web/package.json': pkg({}),
      'apps/web/cypress.config.ts': '',
    })
    expect(detectRunners(root)).toEqual(['cypress'])
  })
})

describe('parseRunners', () => {
  it('takes a comma-separated list of known runners', () => {
    expect(parseRunners('ember, cypress,gherkin')).toEqual(['ember', 'cypress', 'gherkin'])
  })

  it('takes an empty list as none', () => {
    expect(parseRunners('')).toEqual([])
  })

  it('names an unknown runner and lists the known ones', () => {
    expect(() => parseRunners('ember,mocha')).toThrow(/unknown runner "mocha".*known: ember,/)
  })

  it('names each runner once, however often it is given', () => {
    expect(parseRunners('ember,ember, cypress,ember')).toEqual(['ember', 'cypress'])
    expect(toRunners(['cypress', 'cypress'])).toEqual(['cypress'])
  })
})

describe('detectGherkinAdapters', () => {
  it('maps each Gherkin package to its @harnessed-ts/gherkin entry point', () => {
    const root = repo({
      'package.json': pkg({
        'playwright-bdd': '*',
        '@cucumber/cucumber': '*',
        '@badeball/cypress-cucumber-preprocessor': '*',
        'ember-cli-yadda': '*',
      }),
    })
    expect(detectGherkinAdapters(root)).toEqual(['playwright-bdd', 'cucumber', 'cypress', 'yadda'])
  })

  it('finds only the one in use', () => {
    const root = repo({ 'package.json': pkg({ 'ember-cli-yadda': '*' }) })
    expect(detectGherkinAdapters(root)).toEqual(['yadda'])
  })
})

describe('detectEmberUnderVitest', () => {
  it('is true when an Ember package has vitest or ember-vitest', () => {
    const withVitest = (runner: string) =>
      repo({ 'package.json': pkg({ 'ember-source': '*', [runner]: '*' }) })
    expect(detectEmberUnderVitest(withVitest('ember-vitest'))).toBe(true)
    expect(detectEmberUnderVitest(withVitest('vitest'))).toBe(true)
  })

  it('is false for a QUnit-only repo', () => {
    expect(
      detectEmberUnderVitest(
        repo({ 'package.json': pkg({ 'ember-source': '*', 'ember-qunit': '*' }) }),
      ),
    ).toBe(false)
  })

  it('is false for vitest with no Ember beside it', () => {
    expect(detectEmberUnderVitest(repo({ 'package.json': pkg({ vitest: '*' }) }))).toBe(false)
  })

  it('needs Ember and Vitest in the same package of a monorepo', () => {
    const files = {
      'package.json': pkg({ prettier: '^3.0.0' }),
      'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
      'apps/web/package.json': pkg({ 'ember-source': '*', 'ember-qunit': '*' }),
      'packages/utils/package.json': pkg({ vitest: '*' }),
    }
    expect(detectEmberUnderVitest(repo(files))).toBe(false)
    expect(
      detectEmberUnderVitest(
        repo({ ...files, 'apps/web/package.json': pkg({ 'ember-source': '*', vitest: '*' }) }),
      ),
    ).toBe(true)
  })
})
