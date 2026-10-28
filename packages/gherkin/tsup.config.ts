import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/playwright-bdd.ts',
    'src/cucumber.ts',
    'src/nightwatch.ts',
    'src/cypress.ts',
    'src/yadda.ts',
  ],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    '@harnessed-ts/core',
    '@harnessed-ts/nightwatch',
    '@playwright/test',
    '@cucumber/cucumber',
    'nightwatch',
    'yadda',
  ],
})
