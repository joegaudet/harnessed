import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/vite.ts', 'src/babel.ts'],
    // No `shims`: tsup's import.meta shim runs at load and breaks under a
    // jsdom-style `document`. babel.ts uses __filename in the CJS build instead.
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    external: ['esbuild', /^@babel\//],
  },
  {
    // Loaders, ESM only: `node --import` and Bun's preload both load modules,
    // and register() resolves its hooks file against import.meta.url.
    entry: ['src/register.ts', 'src/register-hooks.ts', 'src/bun.ts'],
    format: ['esm'],
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    external: ['esbuild'],
  },
])
