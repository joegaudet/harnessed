import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'
import type { Plugin } from 'esbuild'
import { defineConfig } from 'tsup'

/**
 * `import code from './x?bundle'` becomes the text of `./x` bundled into one
 * browser script: how the page agent, interceptors and all, ships as a string
 * a remote driver can inject.
 */
const bundleAsText: Plugin = {
  name: 'bundle-as-text',
  setup(builder) {
    builder.onResolve({ filter: /\?bundle$/ }, args => ({
      path: resolve(dirname(args.importer), `${args.path.replace(/\?bundle$/, '')}.ts`),
      namespace: 'bundle-as-text',
    }))
    builder.onLoad({ filter: /.*/, namespace: 'bundle-as-text' }, async args => {
      const result = await build({
        entryPoints: [args.path],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        minify: true,
        // The interceptors' browser builds, not their Node ones.
        conditions: ['browser'],
      })
      return { contents: result.outputFiles[0]!.text, loader: 'text' }
    })
  },
}

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/builders.ts',
    'src/in-page.ts',
    'src/remote-page.ts',
    'src/graphql-schema.ts',
    'src/vitest.ts',
  ],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  external: [/^@harnessed-ts\//, /^@mswjs\//, 'graphql', /^node:/, 'vitest'],
  esbuildPlugins: [bundleAsText],
})
