import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/builders.ts',
    'src/in-page.ts',
    'src/graphql-schema.ts',
    'src/vitest.ts',
  ],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [/^@harnessed-ts\//, /^@mswjs\//, 'graphql', /^node:/, 'vitest'],
})
