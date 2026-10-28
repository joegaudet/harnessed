import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/page.ts', 'src/ember.ts', 'src/ember-node.ts'],
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
    // The app's own Ember, resolved by its build: Embroider maps these to ember-source.
    /^@ember\//,
    'content-tag',
  ],
})
