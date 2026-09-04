import type { Rule } from 'eslint'
import noPageOrScreenInHarness from './rules/no-page-or-screen-in-harness'
import noRawLocatorInTest from './rules/no-raw-locator-in-test'
import noReachThroughCast from './rules/no-reach-through-cast'
import requireHost from './rules/require-host'
import requireWaitForReady from './rules/require-wait-for-ready'

export const rules: Record<string, Rule.RuleModule> = {
  'no-page-or-screen-in-harness': noPageOrScreenInHarness,
  'no-raw-locator-in-test': noRawLocatorInTest,
  'no-reach-through-cast': noReachThroughCast,
  'require-host': requireHost,
  'require-wait-for-ready': requireWaitForReady,
}

const meta = { name: '@harnessed/eslint-plugin', version: '0.1.0' }

/**
 * Turns the harness conventions into a gate. Written rules get followed until
 * someone is in a hurry; these do not.
 *
 * ```js
 * // eslint.config.js
 * import harnessed from '@harnessed/eslint-plugin'
 *
 * export default [harnessed.configs.recommended]
 * ```
 */
const plugin = {
  meta,
  rules,
  configs: {} as Record<string, unknown>,
}

plugin.configs.recommended = {
  name: 'harnessed/recommended',
  plugins: { harnessed: plugin },
  rules: {
    'harnessed/no-page-or-screen-in-harness': 'error',
    'harnessed/no-reach-through-cast': 'error',
    'harnessed/require-host': 'error',
    'harnessed/require-wait-for-ready': 'error',
    // A suggestion by default: a repo mid-adoption still has tests that predate
    // their harnesses, and failing the build on those helps nobody.
    'harnessed/no-raw-locator-in-test': 'warn',
  },
}

plugin.configs.strict = {
  name: 'harnessed/strict',
  plugins: { harnessed: plugin },
  rules: {
    ...(plugin.configs.recommended as { rules: Record<string, string> }).rules,
    'harnessed/no-raw-locator-in-test': 'error',
  },
}

export default plugin
