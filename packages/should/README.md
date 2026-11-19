# @harnessed-ts/should

Should-style assertions for [harnessed](https://github.com/joegaudet/harnessed#readme)
harnesses, under every runner: Vitest, Playwright, Cypress, WebdriverIO,
Nightwatch, Puppeteer, TestCafe, node:test, Bun, and Ember's QUnit and Mocha.

```ts
import '@harnessed-ts/should/register' // once, in the test setup file
```

```ts
await form.should.error.be.null() // expect(await form.error()).toBeNull()
await form.should.error.not.be.null()
await grid.should.labelAt(1).equal('Medium')
await form.submitButton.should.be.absent()
await form.should.be.absent() // the harness's own host
```

`harness.should.<method>` calls the method when the assertion runs and asserts
on what it resolved to. `harness.should.<target>` and `query.should` take the
harness matchers `absent`, `selected` and `readAs`, with the same failure
messages as the Vitest, Playwright, QUnit and Chai assertions. Every terminal
is a call that returns a promise, so **await every one**.
`@typescript-eslint/no-floating-promises` or `harnessed/await-should` catches a
missing `await`.

The types follow the harness: a misspelled method, a method that resolves
`void`, and an expected value of the wrong type are all compile errors.

- **`@harnessed-ts/should/register`**: `null`, `true`, `false`, `undefined`,
  `equal`, `eql`, `match`, `include`, `above`, `below`, `length`, and the
  harness matchers, with `not` and `deep`.
- **`@harnessed-ts/should/bdd/register`**: all of that, plus Chai's BDD
  vocabulary as calls: `ok()`, `a('string')`, `property('name', 'Ada')`,
  `members([...])`, `within(1, 5)`, `rejectedWith(/locked/)`, and the rest.

A failure throws an `AssertionError` carrying `actual` and `expected`, so the
runner shows a diff. With `retryAssertions` on (`configure({ retryAssertions: true })`
from `@harnessed-ts/core`), an assertion reads again until it passes or
`defaultTimeout` runs out. `@harnessed-ts/cypress/support` turns it on, to match
Cypress's own `.should`.

The [guide](https://joegaudet.com/harnessed/guide/) covers it under Writing harnesses → Should assertions.

MIT © Joe Gaudet, Jay Seo
