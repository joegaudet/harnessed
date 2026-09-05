import { join } from 'node:path'
import { clearConfigCache, loadConfig, loadConfigFor } from '@harnessed/config'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { beforeEach, describe, expect, it } from 'vitest'
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
 * The rules used to hardcode `harness/`, so a repo that keeps them elsewhere had
 * to repeat its layout in eslint.config.js — and could then disagree with the
 * config file the docs generator reads.
 */
describe('rules honour the configured harness directory', () => {
  RuleTester.afterAll = () => {}
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
