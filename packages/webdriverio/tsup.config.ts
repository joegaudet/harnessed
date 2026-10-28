import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/matchers.ts', 'src/mock.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    '@harnessed-ts/mock',
    '@harnessed-ts/mock/in-page',
    '@harnessed-ts/mock/remote-page',
    /^@mswjs\//,
    '@harnessed-ts/core',
    '@harnessed-ts/resolve',
    '@harnessed-ts/resolve/inject',
    '@harnessed-ts/resolve/webdriver',
    'expect-webdriverio',
    'webdriverio',
  ],
})
