'use strict'

const EmberApp = require('ember-cli/lib/broccoli/ember-app')

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    'ember-cli-babel': { enableTypeScriptTransform: true },
    babel: {
      // Harness files get standard decorators and `accessor`; the app's own
      // @tracked fields stay with ember-cli-babel's legacy transform.
      plugins: [require.resolve('@harnessed-ts/core/babel')],
    },
  })

  return app.toTree()
}
