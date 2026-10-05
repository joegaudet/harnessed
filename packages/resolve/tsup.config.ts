import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/inject.ts'],
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    // `import.meta.url` in inject.ts must work from the CJS build too.
    shims: true,
    external: ['@harnessed-ts/core', '@testing-library/dom'],
  },
  {
    // The injectable build: everything bundled, nothing left to resolve, because
    // the page it lands in has no module loader.
    entry: { inject: 'src/inject.global.ts' },
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    minify: true,
    sourcemap: false,
    clean: false,
    noExternal: [/.*/],
    outExtension: () => ({ js: '.global.js' }),
  },
])
