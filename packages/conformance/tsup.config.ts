import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/fixture.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  // The fixture is React; the specs are decorated harnesses. esbuild lowers both,
  // which is why the target above must stay at or below es2022.
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  external: [
    '@harnessed/core',
    '@harnessed/dom',
    '@harnessed/playwright',
    '@harnessed/route',
    '@playwright/test',
    '@testing-library/dom',
    '@testing-library/react',
    '@testing-library/user-event',
    'react',
    'react-dom',
    'vitest',
  ],
})
