import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * ESLint 8.57 with a legacy `.eslintrc`, the way an app that has not moved to
 * flat config loads the plugin: `require()` of the built CJS file, then
 * `plugins: ['@harnessed-ts']` and `plugin:@harnessed-ts/<config>`. Run against
 * `dist/`, so `pnpm build` must run first.
 */
const require = createRequire(import.meta.url)
const plugin = require('../dist/index.cjs') as {
  rules: Record<string, unknown>
  configs: Record<string, { plugins?: unknown; rules?: Record<string, unknown> }>
}
/** The slice of ESLint 8's API used here: it ships no types, and `eslint`'s are v10's. */
interface LegacyESLint {
  lintText(
    code: string,
    options: { filePath: string },
  ): Promise<Array<{ messages: Array<{ ruleId: string | null; severity: number }> }>>
}
const { ESLint } = require('eslint8') as {
  ESLint: new (options: Record<string, unknown>) => LegacyESLint
}
// The parser typescript-eslint itself depends on, by path: eslintrc resolves a
// parser name from the linted project, which this throwaway directory is not.
const parser = require.resolve('@typescript-eslint/parser', {
  paths: [dirname(require.resolve('typescript-eslint'))],
})

const cwd = mkdtempSync(join(tmpdir(), 'harnessed-eslintrc-'))
afterAll(() => rmSync(cwd, { recursive: true, force: true }))

async function lint(code: string, path: string, config: Record<string, unknown>) {
  const eslint = new ESLint({
    cwd,
    useEslintrc: false,
    // What `plugins: ['@harnessed-ts']` loads, handed over instead of resolved.
    plugins: { '@harnessed-ts': plugin as never },
    overrideConfig: {
      parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      ...config,
    },
  })
  const [result] = await eslint.lintText(code, { filePath: join(cwd, path) })
  return result!.messages
}

describe('under ESLint 8 and .eslintrc', () => {
  it('require() hands eslintrc the rules and configs at the top level, not under .default', () => {
    expect(Object.keys(plugin.rules)).toContain('no-raw-locator-in-test')
    expect(plugin.configs['legacy-recommended']?.plugins).toEqual(['@harnessed-ts'])
    expect(plugin.configs['legacy-strict']?.plugins).toEqual(['@harnessed-ts'])
  })

  it('reports a rule enabled by name', async () => {
    const messages = await lint(
      `import { screen } from '@testing-library/dom'\nscreen.getByRole('button')\n`,
      'tests/checkout.test.ts',
      { plugins: ['@harnessed-ts'], rules: { '@harnessed-ts/no-raw-locator-in-test': 'error' } },
    )
    expect(messages.map(message => [message.ruleId, message.severity])).toEqual([
      ['@harnessed-ts/no-raw-locator-in-test', 2],
    ])
  })

  it('runs the legacy configs, with the same severities as the flat ones', async () => {
    const harness = `import { ComponentHarness, Harness, testId } from '@harnessed-ts/core'
@Harness({ host: testId('x') })
export class X extends ComponentHarness {
  async heading() { return document.querySelector('h1') }
}
`
    const recommended = await lint(harness, 'harness/X.harness.ts', {
      extends: ['plugin:@harnessed-ts/legacy-recommended'],
    })
    expect(recommended.map(message => message.ruleId)).toContain(
      '@harnessed-ts/no-runner-import-in-harness',
    )

    const raw = `import { screen } from '@testing-library/dom'\nscreen.getByRole('button')\n`
    const asWarning = await lint(raw, 'tests/a.test.ts', {
      extends: ['plugin:@harnessed-ts/legacy-recommended'],
    })
    const asError = await lint(raw, 'tests/a.test.ts', {
      extends: ['plugin:@harnessed-ts/legacy-strict'],
    })
    expect(asWarning.map(message => message.severity)).toEqual([1])
    expect(asError.map(message => message.severity)).toEqual([2])
  })

  it('legacy configs enable exactly the rules their flat counterparts do', () => {
    for (const name of ['recommended', 'strict']) {
      const flat = plugin.configs[name]!.rules!
      const legacy = plugin.configs[`legacy-${name}`]!.rules!
      expect(
        Object.fromEntries(
          Object.entries(legacy).map(([rule, level]) => [
            rule.replace('@harnessed-ts/', ''),
            level,
          ]),
        ),
      ).toEqual(
        Object.fromEntries(
          Object.entries(flat).map(([rule, level]) => [rule.replace('harnessed/', ''), level]),
        ),
      )
    }
  })
})
