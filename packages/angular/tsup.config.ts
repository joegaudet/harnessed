import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [
    '@harnessed-ts/core',
    '@harnessed-ts/resolve',
    '@angular/common',
    '@angular/core',
    '@angular/router',
    '@testing-library/dom',
    '@testing-library/user-event',
  ],
})
