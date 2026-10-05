---
'@harnessed-ts/chai': minor
'@harnessed-ts/qunit': minor
'@harnessed-ts/core': minor
---

Two new assertion packages, both backed by core's one matcher implementation so the messages read the same under every runner:

- `@harnessed-ts/qunit`: `install(QUnit)` adds `assert.harness(x)` with `isAbsent`/`isPresent`, `isSelected`/`isNotSelected`, and `readsAs`/`doesNotReadAs`, reported through `pushResult`. For ember-qunit and any QUnit suite.
- `@harnessed-ts/chai`: `chai.use(harnessedChai)` adds `absent`, `selected`, and `readAs`, awaitable and negatable. For Mocha, ember-mocha, Cypress, and WebdriverIO under Mocha.

`harnessMatchers` results now carry `observed: { actual, expected }`, which the QUnit and Chai adapters report so their runners can show what was read.
