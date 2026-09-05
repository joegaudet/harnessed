import js from '@eslint/js'
// Resolved through the workspace link, so this lints against the built plugin.
import harnessed from '@harnessed/eslint-plugin'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/*.d.ts',
      '**/.features-gen/**',
      // Shipped templates, not source: they reference modules a consumer supplies.
      'packages/claude/assets/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Augmenting Playwright's matchers means declaring into its global
      // namespace; there is no module-syntax equivalent.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
  {
    // Build tooling and rule tests are outside the publishable projects on
    // purpose, so type-aware linting is pointed at a project that includes them.
    files: [
      '*.config.ts',
      'eslint.config.js',
      'packages/*/tsup.config.ts',
      'packages/*/vitest.config.ts',
      'packages/*/tests/**/*.ts',
      'packages/conformance/runners/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.tools.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['packages/playwright/src/bdd.ts'],
    rules: {
      // Playwright reads a fixture's destructured parameter names to work out its
      // dependencies and rejects a plain parameter, so an empty pattern is the
      // only way to declare a fixture that depends on nothing.
      'no-empty-pattern': 'off',
    },
  },
  // Dogfooding: the plugin's own rules run over the conformance harnesses, which
  // are the closest thing this repo has to a consumer.
  harnessed.configs.strict,
  {
    files: ['packages/conformance/**'],
    settings: {},
    rules: {
      'harnessed/no-page-or-screen-in-harness': ['error', { harnessDirs: ['harnesses'] }],
      'harnessed/require-host': ['error', { harnessDirs: ['harnesses'] }],
      'harnessed/require-wait-for-ready': ['error', { harnessDirs: ['harnesses'] }],
      // The conformance runners construct harnesses and drive the page directly —
      // that is their job, and there is no harness to route through.
      'harnessed/no-raw-locator-in-test': 'off',
    },
  },
)
