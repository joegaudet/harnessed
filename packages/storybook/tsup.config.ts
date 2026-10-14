import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/page.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    '@harnessed-ts/core',
    '@harnessed-ts/dom',
    '@harnessed-ts/page',
    '@testing-library/dom',
    /^storybook(\/.*)?$/,
  ],
})
