import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // Built on its own: in-process drivers load this entry in a real browser, so
    // nothing Node-only from inject.ts may land in a chunk the two share.
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    external: ['@harnessed-ts/core', '@testing-library/dom'],
  },
  {
    entry: ['src/inject.ts'],
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    // No `shims`: tsup's import.meta shim runs at load and takes a browser branch
    // whenever a `document` global exists — a test process under jsdom. The CJS
    // build finds its directory through __filename instead (see inject.ts).
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
