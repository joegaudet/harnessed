import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/matchers.ts', 'src/matchers-bun.ts', 'src/mock.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    /^@harnessed-ts\//,
    /^@mswjs\//,
    '@testing-library/dom',
    '@testing-library/user-event',
    'vitest',
    'bun:test',
  ],
})
