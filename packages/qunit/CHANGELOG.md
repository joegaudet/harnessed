# @harnessed-ts/qunit

## 0.4.0

### Minor Changes

- 9666a3d: Two new assertion packages, both backed by core's one matcher implementation so the messages read the same under every runner:

  - `@harnessed-ts/qunit`: `install(QUnit)` adds `assert.harness(x)` with `isAbsent`/`isPresent`, `isSelected`/`isNotSelected`, and `readsAs`/`doesNotReadAs`, reported through `pushResult`. For ember-qunit and any QUnit suite.
  - `@harnessed-ts/chai`: `chai.use(harnessedChai)` adds `absent`, `selected`, and `readAs`, awaitable and negatable. For Mocha, ember-mocha, Cypress, and WebdriverIO under Mocha.

  `harnessMatchers` results now carry `observed: { actual, expected }`, which the QUnit and Chai adapters report so their runners can show what was read.

### Patch Changes

- Updated dependencies [9666a3d]
- Updated dependencies [9666a3d]
- Updated dependencies [1823546]
  - @harnessed-ts/core@0.4.0
