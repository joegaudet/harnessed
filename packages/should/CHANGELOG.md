# @harnessed-ts/should

## 0.10.0

### Minor Changes

- d396361: `should` now follows the member it asserts on: `await form.error.should.be.null()`,
  and `await form.cell(2, 'name').should.equal('2:name')` for a method with arguments.
  `form.error().should` is typed by the method; `form.error.should` accepts any expected
  value. **Breaking:** `form.should.<member>` is gone; `form.should` asserts only on the
  harness's own host (`form.should.be.absent()`). Suites that also use Chai's should
  interface import `/register-scoped` (or `/bdd/register-scoped`), which leaves out the
  global `Function.should` and `Promise.should` types that would hide Chai's. Core adds `registerHarnessWrapper`,
  which `@harnessed-ts/should/register` uses to wrap each harness. Storybook's step
  labels keep masking secrets, and keep `should`, when should is registered.

### Patch Changes

- Updated dependencies [d396361]
  - @harnessed-ts/core@0.10.0

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
