import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    shims: true,
  },
  {
    // The bin is ESM only: it resolves its packaged assets via import.meta.url.
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
  },
])
