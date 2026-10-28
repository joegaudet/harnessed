import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/mock.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    '@harnessed-ts/mock',
    '@harnessed-ts/mock/in-page',
    /^@mswjs\//,
    '@harnessed-ts/core',
    '@harnessed-ts/resolve',
    'testcafe',
  ],
})
