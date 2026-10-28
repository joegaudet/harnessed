// The same specs and browsers as nightwatch.conf.cjs, under Nightwatch's Mocha
// test runner instead of its own, so the Chai path is proven under both.
const base = require('./nightwatch.conf.cjs')

module.exports = {
  ...base,
  test_runner: {
    type: 'mocha',
    options: { ui: 'bdd', reporter: 'spec', timeout: 60_000 },
  },
}
