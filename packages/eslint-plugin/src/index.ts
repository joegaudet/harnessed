import type { Rule } from 'eslint'
import behaviouralMethodNames from './rules/behavioural-method-names'
import harnessPublicSurface from './rules/harness-public-surface'
import noComponentHarnessInTest from './rules/no-component-harness-in-test'
import noPageOrScreenInHarness from './rules/no-page-or-screen-in-harness'
import noRawLocatorInTest from './rules/no-raw-locator-in-test'
import noReachThroughCast from './rules/no-reach-through-cast'
import noRunnerImportInHarness from './rules/no-runner-import-in-harness'
import requireHost from './rules/require-host'
import requireWaitForReady from './rules/require-wait-for-ready'

export const rules: Record<string, Rule.RuleModule> = {
  'behavioural-method-names': behaviouralMethodNames,
  'harness-public-surface': harnessPublicSurface,
  'no-component-harness-in-test': noComponentHarnessInTest,
  'no-page-or-screen-in-harness': noPageOrScreenInHarness,
  'no-raw-locator-in-test': noRawLocatorInTest,
  'no-reach-through-cast': noReachThroughCast,
  'no-runner-import-in-harness': noRunnerImportInHarness,
  'require-host': requireHost,
  'require-wait-for-ready': requireWaitForReady,
}

const meta = { name: '@harnessed-ts/eslint-plugin', version: '0.3.0' }

/**
 * Turns the harness conventions into a gate. Written rules get followed until
 * someone is in a hurry; these do not.
 *
 * ```js
 * // eslint.config.js
 * import harnessed from '@harnessed-ts/eslint-plugin'
 *
 * export default [harnessed.configs.recommended]
 * ```
 */
const recommendedRules = {
  'harnessed/no-page-or-screen-in-harness': 'error',
  'harnessed/no-reach-through-cast': 'error',
  'harnessed/require-host': 'error',
  'harnessed/require-wait-for-ready': 'error',
  // Harnesses speak in behaviours: no runner or DOM vocabulary in, none out.
  'harnessed/no-runner-import-in-harness': 'error',
  'harnessed/harness-public-surface': 'error',
  // A heuristic over names, so a warning even in strict: `pressRelease()` is a
  // fine method in a newsroom app. `allow` takes the exceptions.
  'harnessed/behavioural-method-names': 'warn',
  // A suggestion by default: a repo mid-adoption still has tests that predate
  // their harnesses, and failing the build on those helps nobody.
  'harnessed/no-raw-locator-in-test': 'warn',
} as const

const strictRules = {
  ...recommendedRules,
  'harnessed/no-raw-locator-in-test': 'error',
  // Strict only: a repo mid-adoption has tests that reach a component harness
  // directly, and those should keep passing until it has pages to enter through.
  'harnessed/no-component-harness-in-test': 'error',
} as const

/**
 * The same rules under the name eslintrc gives this package: `@harnessed-ts`,
 * from `@harnessed-ts/eslint-plugin`. Flat config lets a config name its own
 * plugin key; `.eslintrc` does not.
 */
function legacy(flat: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(flat).map(([rule, level]) => [
      rule.replace(/^harnessed\//, '@harnessed-ts/'),
      level,
    ]),
  )
}

/**
 * Flat configs (`recommended`, `strict`) for ESLint 9+, and eslintrc ones
 * (`legacy-recommended`, `legacy-strict`) for ESLint 8.57 with `.eslintrc`:
 *
 * ```json
 * { "extends": ["plugin:@harnessed-ts/legacy-recommended"] }
 * ```
 */
export const configs: Record<string, unknown> = {}

const plugin = { meta, rules, configs }

configs.recommended = {
  name: 'harnessed/recommended',
  plugins: { harnessed: plugin },
  rules: recommendedRules,
}

configs.strict = {
  name: 'harnessed/strict',
  plugins: { harnessed: plugin },
  rules: strictRules,
}

configs['legacy-recommended'] = { plugins: ['@harnessed-ts'], rules: legacy(recommendedRules) }
configs['legacy-strict'] = { plugins: ['@harnessed-ts'], rules: legacy(strictRules) }

// Named as well as default: eslintrc `require()`s the CJS build and reads
// `rules` and `configs` off what it gets, never off `.default`.
export { meta }
export default plugin
