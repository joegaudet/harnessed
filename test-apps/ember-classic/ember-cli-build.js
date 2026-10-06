'use strict'

const path = require('path')
const EmberApp = require('ember-cli/lib/broccoli/ember-app')
const { Funnel } = require('broccoli-funnel')
const { MergeTrees } = require('broccoli-merge-trees')
const webpack = require('webpack')

/** Yadda's installed files, wherever pnpm puts them. */
const yaddaModule = /[\\/]node_modules[\\/]yadda(?:[\\/]|$)/

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    'ember-cli-babel': { enableTypeScriptTransform: true },
    babel: {
      // Harness files get standard decorators and `accessor`; the app's own
      // @tracked fields stay with ember-cli-babel's legacy transform.
      plugins: [require.resolve('@harnessed-ts/core/babel')],
    },
    autoImport: {
      webpack: {
        // Yadda's index also loads its file search and node:test plugin, which a
        // browser never calls. ember-cli-yadda stubs the bare `fs` and `path`
        // Yadda 2 imported; Yadda 3 writes `node:fs`, a scheme webpack will not
        // resolve to a fallback, so strip the scheme first and stub all three.
        // Both apply only to Yadda's own modules: a `node:` import anywhere else
        // still fails the build, where it belongs.
        plugins: [
          new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
            if (yaddaModule.test(resource.context ?? '')) {
              resource.request = resource.request.replace(/^node:/, '')
            }
          }),
        ],
        module: {
          rules: [
            {
              test: yaddaModule,
              resolve: { fallback: { fs: false, path: false, test: false } },
            },
          ],
        },
      },
    },
    trees: {
      // The shared Gherkin feature, read where it lives rather than copied in:
      // ember-cli-yadda compiles tests/acceptance/harness-world.feature into a
      // test module whose steps are tests/acceptance/steps/harness-world-steps.
      tests: new MergeTrees([
        'tests',
        new Funnel(path.join(__dirname, '../../packages/gherkin/features'), {
          include: ['*.feature'],
          destDir: 'acceptance',
        }),
      ]),
    },
  })

  return app.toTree()
}
