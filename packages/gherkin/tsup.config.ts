import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/playwright-bdd.ts',
    'src/cucumber.ts',
    'src/cypress.ts',
    'src/yadda.ts',
  ],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: ['@harnessed-ts/core', '@playwright/test', '@cucumber/cucumber', 'yadda'],
})
