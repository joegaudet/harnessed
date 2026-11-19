# Should assertions

```bash
npm i -D @harnessed-ts/should
```

Import it once, from your test setup file, and every harness and every target
gets a `.should`:

```ts
import '@harnessed-ts/should/register'

await form.should.error.be.null() // expect(await form.error()).toBeNull()
await form.should.error.not.be.null()
await form.submitButton.should.be.absent()
```

It works the same under every runner and driver, because it needs nothing from
the runner: a failure throws an `AssertionError` that carries `actual` and
`expected`, which Vitest, Playwright, Mocha, Cypress, QUnit, node:test and Bun
all report. Where each runner's setup file is, and how to import it there, is on
that runner's page.

## Reading the chain

`harness.should` takes a member name, then reads like Chai:

- **A method** (`form.should.error`) is called when the assertion runs, and the
  assertion is about what it resolved to. A method that takes arguments is
  called with them: `grid.should.labelAt(1).equal('Medium')`.
- **A target**, meaning a query field or a child harness (`form.should.errorLine`),
  takes the harness matchers.
- **Nothing**: `form.should.be.absent()` asserts on the harness's own host.

`query.should` takes the harness matchers directly:
`form.errorLine.should.readAs(/credentials/)`.

Then come words that read well and change nothing (`to`, `be`, `been`, `is`,
`that`, `which`, `and`, `has`, `have`, `with`, `at`, `of`, `same`, `does`,
`but`, `still`, `also`), the flags `not` and `deep`, and a **terminal call**.
Unlike Chai, a terminal is always a call, `be.null()` and not `be.null`, and it
returns a promise.

**Await every assertion.** Reading the page goes through a driver, so an
un-awaited assertion cannot fail the test. `@typescript-eslint/no-floating-promises`
catches a missing `await`, and so does `harnessed/await-should` in
`@harnessed-ts/eslint-plugin`'s recommended config, which needs no type
information.

## What can be asserted on

The types follow the harness. A misspelled member is a compile error, and the
expected value takes the method's own type: `form.should.attempts.equal('3')`
does not compile when `attempts()` resolves a number. Left out:

- A method that resolves `void`. That is an action, not a reading, and under
  retry it would run again.
- A plain field, which is not read through a driver.
- A method that needs arguments, until it is called with them.

## Vocabulary

`@harnessed-ts/should/register`:

| Assertion                                                       | Passes when the value                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `null()`, `true()`, `false()`, `undefined()`                    | is exactly that                                                           |
| `equal(x)` (`equals`, `eq`)                                     | `=== x`, or is structurally equal after `.deep`                           |
| `eql(x)` (`eqls`)                                               | is structurally equal to `x`                                              |
| `match(re)`                                                     | is a string matching `re`                                                 |
| `include(x)` (`includes`, `contain`, `contains`)                | contains a substring, has an array or Set member, or has these properties |
| `above(n)` (`gt`, `greaterThan`), `below(n)` (`lt`, `lessThan`) | is a number past `n`                                                      |
| `length(n)` (`lengthOf`)                                        | has that `length` (string, array) or `size` (Map, Set)                    |
| `absent()`, `selected()`, `readAs(x)`                           | targets only: the [harness matchers](matchers.md), same messages          |

`@harnessed-ts/should/bdd/register` installs all of that plus Chai's BDD
vocabulary, as calls: `ok()`, `exist()`, `empty()`, `a(type)` / `an(type)`
(also a word: `be.an.instanceOf(Array)`), `instanceOf(C)`, `property(name, value?)`,
`ownProperty(name, value?)`, `keys(...names)`, `members(list)`, `oneOf(list)`,
`string(part)`, `least(n)` / `gte`, `most(n)` / `lte`, `within(low, high)`,
`closeTo(n, delta)` / `approximately`, `satisfy(fn)`, `NaN()`, `finite()`,
`frozen()`, `sealed()`, `extensible()`, and `rejected()` / `rejectedWith(x)`
for a method that rejects. Import one register or the other, not both.

## Failures

```text
expected LoginFormHarness.errorText() to be null, but it was "Bad credentials"
expected CardGridHarness.labelAt(1) to equal "Large", but it was "Medium"
expected the target to be absent, but 1 node(s) matched
```

A message names the harness, the method and its arguments, and what was read.
After `.not` it says only what was expected, and the error sets `showDiff: false`,
since the two values agreeing was the problem.

## Retrying

By default an assertion reads once. With `retryAssertions` on, it reads again,
calling the method again each time, until it passes or `defaultTimeout` runs
out, then reports the last reading. An error thrown while reading is retried in
the same way, because the target may not exist yet.

```ts
import { configure } from '@harnessed-ts/core'

configure({ retryAssertions: true })
```

`@harnessed-ts/cypress/support` turns it on, so a harness's `.should` behaves
like Cypress's own. Any other suite may turn it on too; see
[Configuration](configuration.md).

## When to use `expect` instead

Should style is a way of writing the same checks; it does not replace the
[matchers](matchers.md). Mixing styles works, and the failure messages for the
harness matchers are identical. Reach for `expect(await …)` when the value needs
work first, such as a `map` or a computation, before it is compared.
