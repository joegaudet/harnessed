import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/vite.ts', 'src/babel.ts'],
  // `import.meta.url` in babel.ts must work from the CJS build Babel loads.
  shims: true,
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: ['esbuild', /^@babel\//],
})
