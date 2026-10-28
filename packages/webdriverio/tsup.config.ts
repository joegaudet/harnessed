import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/matchers.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    '@harnessed-ts/core',
    '@harnessed-ts/resolve',
    '@harnessed-ts/resolve/inject',
    '@harnessed-ts/resolve/webdriver',
    'expect-webdriverio',
    'webdriverio',
  ],
})
