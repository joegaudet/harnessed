import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/matchers.ts', 'src/mock.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  // `vitest/browser` is a virtual module Vitest serves inside browser mode; it
  // must stay an import for Vitest to resolve, never be bundled.
  external: [
    '@harnessed-ts/mock',
    '@harnessed-ts/mock/in-page',
    /^@mswjs\//,
    '@harnessed-ts/core',
    '@harnessed-ts/resolve',
    'vitest',
    'vitest/browser',
  ],
})
