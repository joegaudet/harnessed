import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearConfigCache, loadConfig, loadConfigFor } from '@harnessed-ts/config'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import requireHost from '../src/rules/require-host'

const CONFIGURED = join(import.meta.dirname, 'fixtures/configured')

describe('harnessed.config.ts', () => {
  beforeEach(clearConfigCache)

  it('is loaded from disk, TypeScript and all', () => {
    expect(loadConfig(CONFIGURED)?.layout?.harnesses).toBe('lib/harnesses')
  })

  it('returns undefined for a repo with no config', () => {
    expect(loadConfig(join(import.meta.dirname, 'fixtures'))).toBeUndefined()
  })

  it('is found by walking up from the file being checked', () => {
    const deep = join(CONFIGURED, 'lib/harnesses/nested/Form.harness.ts')
    expect(loadConfigFor(deep)?.layout?.harnesses).toBe('lib/harnesses')
  })
})

/**
 * Loading a config runs it, so the walk up from a file must stop at the project
 * it belongs to: a `harnessed.config.ts` in a parent directory -- a home
 * directory, a shared checkout, /tmp -- is someone else's code. The trees here
 * live in the OS temp directory, outside any git checkout, so the only project
 * boundaries are the ones each test writes.
 */
describe('the walk up stops at the project root', () => {
  const made: string[] = []
  const tree = (files: Record<string, string>): string => {
    const root = mkdtempSync(join(tmpdir(), 'harnessed-config-'))
    made.push(root)
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true })
      writeFileSync(join(root, path), contents)
    }
    return root
  }
  const config = (harnesses: string) =>
    `export default { layout: { harnesses: ${JSON.stringify(harnesses)} } }\n`
  // A config that records being executed, to prove it never was.
  const tripwire = `globalThis.__harnessedTripwire = true\n${config('outside')}`
  const tripped = () => (globalThis as { __harnessedTripwire?: boolean }).__harnessedTripwire

  beforeEach(() => {
    clearConfigCache()
    delete (globalThis as { __harnessedTripwire?: boolean }).__harnessedTripwire
  })
  afterEach(() => {
    for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  it('never runs a config above a project with a package.json', () => {
    const root = tree({
      'harnessed.config.ts': tripwire,
      'app/package.json': '{"name":"app"}',
    })
    expect(loadConfigFor(join(root, 'app/src/Form.harness.ts'))).toBeUndefined()
    expect(tripped()).toBeUndefined()
  })

  it('never runs a config above a git checkout', () => {
    const root = tree({
      'harnessed.config.ts': tripwire,
      'repo/.git/HEAD': 'ref: refs/heads/main\n',
      'repo/package.json': '{"name":"repo"}',
    })
    expect(loadConfigFor(join(root, 'repo/src/Form.harness.ts'))).toBeUndefined()
    expect(tripped()).toBeUndefined()
  })

  it('still reads a config in the project root itself', () => {
    const root = tree({
      'harnessed.config.ts': config('lib/harnesses'),
      'package.json': '{"name":"app"}',
    })
    const found = loadConfigFor(join(root, 'src/deep/Form.harness.ts'))
    expect(found?.layout?.harnesses).toBe('lib/harnesses')
  })

  it("reads a pnpm workspace root's config from inside a nested package", () => {
    const root = tree({
      'pnpm-workspace.yaml': "packages: ['packages/*']\n",
      'package.json': '{"name":"mono","private":true}',
      'harnessed.config.ts': config('workspace/harnesses'),
      'packages/app/package.json': '{"name":"app"}',
    })
    const found = loadConfigFor(join(root, 'packages/app/src/Form.harness.ts'))
    expect(found?.layout?.harnesses).toBe('workspace/harnesses')
  })

  it("reads an npm or yarn workspaces root's config from inside a nested package", () => {
    const root = tree({
      'package.json': '{"name":"mono","private":true,"workspaces":["packages/*"]}',
      'harnessed.config.ts': config('workspace/harnesses'),
      'packages/app/package.json': '{"name":"app"}',
    })
    const found = loadConfigFor(join(root, 'packages/app/src/Form.harness.ts'))
    expect(found?.layout?.harnesses).toBe('workspace/harnesses')
  })

  it("reads a git checkout's root config from inside a nested package", () => {
    const root = tree({
      '.git/HEAD': 'ref: refs/heads/main\n',
      'harnessed.config.ts': config('repo/harnesses'),
      'packages/app/package.json': '{"name":"app"}',
    })
    const found = loadConfigFor(join(root, 'packages/app/src/Form.harness.ts'))
    expect(found?.layout?.harnesses).toBe('repo/harnesses')
  })

  it('prefers the nearest config inside the project', () => {
    const root = tree({
      'pnpm-workspace.yaml': "packages: ['packages/*']\n",
      'harnessed.config.ts': config('workspace/harnesses'),
      'packages/app/package.json': '{"name":"app"}',
      'packages/app/harnessed.config.ts': config('app/harnesses'),
    })
    const found = loadConfigFor(join(root, 'packages/app/src/Form.harness.ts'))
    expect(found?.layout?.harnesses).toBe('app/harnesses')
  })
})

/**
 * The rules used to hardcode `harness/`, so a repo that keeps them elsewhere had
 * to repeat its layout in eslint.config.js — and could then disagree with the
 * config file the docs generator reads.
 */
describe('rules honour the configured harness directory', () => {
  RuleTester.describe = describe
  RuleTester.it = it

  const tester = new RuleTester({
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  })

  beforeEach(clearConfigCache)

  tester.run('require-host', requireHost, {
    valid: [
      {
        name: 'the default directory is not policed once a config names another',
        filename: join(CONFIGURED, 'harness/Form.harness.ts'),
        code: `class FormHarness extends ComponentHarness {}`,
        settings: {},
      },
    ],
    invalid: [
      {
        name: 'the directory the config names is policed',
        filename: join(CONFIGURED, 'lib/harnesses/Form.harness.ts'),
        code: `class FormHarness extends ComponentHarness {}`,
        errors: [{ messageId: 'missing' }],
      },
    ],
  })
})
