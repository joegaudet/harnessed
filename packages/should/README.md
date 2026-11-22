# @harnessed-ts/should

Should-style assertions for [harnessed](https://github.com/joegaudet/harnessed#readme)
harnesses, under every runner: Vitest, Playwright, Cypress, WebdriverIO,
Nightwatch, Puppeteer, TestCafe, node:test, Bun, and Ember's QUnit and Mocha.

```ts
import '@harnessed-ts/should/register' // once, in the test setup file
```

```ts
await form.error.should.be.null() // expect(await form.error()).toBeNull()
await form.error.should.not.be.null()
await grid.labelAt(1).should.equal('Medium')
await page.banner.should.be.absent() // a @ChildHarness
await form.should.be.absent() // the harness's own host
```

`harness.<method>.should` calls the method when the assertion runs and asserts
on what it resolved to; `harness.<method>(...args).should` asserts on that call.
A child harness's `.should`, `harness.should` and `query.should` take the
harness matchers `absent`, `selected` and `readAs`, with the same failure
messages as the Vitest, Playwright, QUnit and Chai assertions. Every terminal
is a call that returns a promise, so **await every one**.
`@typescript-eslint/no-floating-promises`, or `harnessed/await-should` from
`@harnessed-ts/eslint-plugin`'s strict config, catches a missing `await`. An
awaited terminal without its call, `await form.error.should.be.null`, rejects
and says so.

`harness.<method>().should` is typed by the method, so an expected value of the
wrong type is a compile error. `harness.<method>.should` is not: TypeScript
can't see the method's type from there, so the short form accepts any expected
value. Don't assert on an action (a method resolving `void`): under retry it runs
again on each attempt.

- **`@harnessed-ts/should/register`**: `null`, `true`, `false`, `undefined`,
  `equal`, `eql`, `match`, `include`, `above`, `below`, `length`, and the
  harness matchers, with `not` and `deep`.
- **`@harnessed-ts/should/bdd/register`**: all of that, plus Chai's BDD
  vocabulary as calls: `ok()`, `a('string')`, `property('name', 'Ada')`,
  `members([...])`, `within(1, 5)`, `rejectedWith(/locked/)`, and the rest.
- **`/register-scoped`** and **`/bdd/register-scoped`**: the same at runtime, without
  the global `Function.should` and `Promise.should` types. Use these if the suite also
  uses Chai's should interface, whose types on functions and promises the globals
  would hide. Only `harness.should` and `query.should` are typed then.

A failure throws an `AssertionError` carrying `actual` and `expected`, so the
runner shows a diff. With `retryAssertions` on (`configure({ retryAssertions: true })`
from `@harnessed-ts/core`), an assertion reads again until it passes or
`defaultTimeout` runs out. `@harnessed-ts/cypress/support` turns it on, to match
Cypress's own `.should`.

The [guide](https://joegaudet.com/harnessed/guide/) covers it under Writing harnesses → Should assertions.

MIT © Joe Gaudet, Jay Seo
