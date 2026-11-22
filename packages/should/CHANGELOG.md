# @harnessed-ts/should

## 0.9.0

### Minor Changes

- 49e6b67: New package `@harnessed-ts/should`: should-style assertions under every runner. Import
  `@harnessed-ts/should/register` once, then `await form.should.error.be.null()`,
  `await grid.should.labelAt(1).equal('Medium')` and `await page.banner.should.be.absent()`.
  `@harnessed-ts/should/bdd/register` adds Chai's full BDD vocabulary.

  Core gains the `retryAssertions` setting, which makes a should assertion read again
  until it passes or `defaultTimeout` runs out. `@harnessed-ts/cypress/support` turns it
  on, to match Cypress's own `.should`. The conformance catalog runs the should specs
  under every driver, and `@harnessed-ts/eslint-plugin` adds `await-should` to its
  strict config.

### Patch Changes

- Updated dependencies [49e6b67]
  - @harnessed-ts/core@0.9.0
