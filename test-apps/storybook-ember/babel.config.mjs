import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMacros } from '@embroider/macros/babel'

const require = createRequire(import.meta.url)
const macros = buildMacros()

/**
 * A minimal Embroider app's Babel: no classic compat, no ember-cli. Its only
 * Ember code is the stories, the fixture they import, and v2 addons.
 */
export default {
  plugins: [
    // First: harness files get standard decorators and `accessor`; everything
    // else stays with decorator-transforms below.
    require.resolve('@harnessed-ts/core/babel'),
    [
      '@babel/plugin-transform-typescript',
      { allExtensions: true, onlyRemoveTypeImports: true, allowDeclareFields: true },
    ],
    ['babel-plugin-ember-template-compilation', { transforms: [...macros.templateMacros] }],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: fileURLToPath(import.meta.resolve('decorator-transforms/runtime-esm')),
        },
      },
    ],
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: dirname(fileURLToPath(import.meta.url)),
        useESModules: true,
        regenerator: false,
      },
    ],
    ...macros.babelMacros,
  ],
  generatorOpts: { compact: false },
}
