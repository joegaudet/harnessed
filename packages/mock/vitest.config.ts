import { dirname, resolve } from 'node:path'
import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { build } from 'esbuild'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vitest/config'

/** `?bundle` imports as tsup.config.ts builds them: the module bundled into one script's text. */
const bundleAsText: Plugin = {
  name: 'bundle-as-text',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!source.endsWith('?bundle') || importer === undefined) return undefined
    return `\0bundle:${resolve(dirname(importer), source.replace(/\?bundle$/, '.ts'))}`
  },
  async load(id) {
    if (!id.startsWith('\0bundle:')) return undefined
    const result = await build({
      entryPoints: [id.slice('\0bundle:'.length)],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      minify: true,
      conditions: ['browser'],
    })
    return `export default ${JSON.stringify(result.outputFiles[0]!.text)}`
  },
}

export default defineConfig({
  plugins: [harnessedDecorators(), bundleAsText],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
