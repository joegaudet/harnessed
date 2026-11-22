import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    register: 'src/register.ts',
    'bdd/index': 'src/bdd/index.ts',
    'bdd/register': 'src/bdd/register.ts',
  },
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  // Shared chunks, so `register` and `bdd/register` fill one assertion table.
  splitting: true,
  external: ['@harnessed-ts/core'],
})
