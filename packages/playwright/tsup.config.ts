import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/matchers.ts', 'src/bdd.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: ['@harnessed-ts/core', '@playwright/test'],
})
