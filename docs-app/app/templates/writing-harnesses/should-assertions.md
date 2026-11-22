# Should assertions

```bash
npm i -D @harnessed-ts/should
```

Import it once, from your test setup file, and every harness and every target
gets a `.should`:

```ts
import '@harnessed-ts/should/register'

await form.error.should.be.null() // expect(await form.error()).toBeNull()
await form.error.should.not.be.null()
await page.banner.should.be.absent() // a @ChildHarness, or form.self
```

It works the same under every runner and driver, because it needs nothing from
the runner: a failure throws an `AssertionError` that carries `actual` and
`expected`, which Vitest, Playwright, Mocha, Cypress, QUnit, node:test and Bun
all report. Where each runner's setup file is, and how to import it there, is on
that runner's page.

## Reading the chain

`should` follows what it asserts on, then reads like Chai:

- **A method**: `form.error.should` calls `error()` when the assertion runs,
  and asserts on what it resolved to. A method that takes arguments is called
  first: `grid.labelAt(1).should.equal('Medium')`. That works on a zero-arg
  method too, `form.error().should.be.null()`, and checks types more strictly;
  see below.
- **A target**: a `@ChildHarness` (`page.banner.should.be.absent()`), or
  `self`, the harness's host element, takes the harness matchers. A public
  `Query` member works too, but `harnessed/harness-public-surface` keeps
  queries private, so prefer a child harness.
- **The harness itself**: `form.should.be.absent()` asserts on its own host.

`query.should` takes the harness matchers directly, for use inside a harness
or with `self`: `price.self.should.readAs(/^\$/)`.

Then come words that read well and change nothing (`to`, `be`, `been`, `is`,
`that`, `which`, `and`, `has`, `have`, `with`, `at`, `of`, `same`, `does`,
`but`, `still`, `also`), the flags `not` and `deep`, and a **terminal call**.
Unlike Chai, a terminal is always a call, `be.null()` and not `be.null`, and it
returns a promise.

**Await every assertion.** Reading the page goes through a driver, so an
un-awaited assertion cannot fail the test. `@typescript-eslint/no-floating-promises`
catches a missing `await`, and so does `harnessed/await-should`, which needs no
type information. That rule is in `@harnessed-ts/eslint-plugin`'s `strict`
config only, because Chai's own should interface (`res.body.should.have.property('id')`)
reads the same and is synchronous; turn it on yourself if you don't use Chai's.

Awaiting a terminal without its call, `await form.error.should.be.null` in
Chai's property style, rejects with `` `.null` is a call: write `.null()` ``
rather than passing without asserting.

## Types

`form.error().should` is typed by the method: the expected value takes the
method's own type, so `form.attempts().should.equal('3')` does not compile when
`attempts()` resolves a number.

`form.error.should` is not. TypeScript cannot see a method's type from a
`should` on the method itself, so the short form accepts any expected value.
Use the called form where that check matters. It is also the form for a typed
callback: `form.attempts().should.satisfy((n: number) => n > 0)` compiles, and
the short form does not.

Both forms rest on global types, `Function.should` and `Promise.should`. If the
suite also uses Chai's should interface, they hide its types on functions and
promises (`fn.should.throw()`), so import `@harnessed-ts/should/register-scoped`
(or `/bdd/register-scoped`) instead. It works the same at runtime; only
`harness.should` and `query.should` are typed.

**Don't assert on an action.** A method that resolves `void`, such as
`submit()`, is an action, not a reading. Under retry, an assertion calls the
method again on each attempt, so `form.submit.should…` would submit again and
again. Neither form refuses it at compile time.

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
the same way, because the target may not exist yet. The deadline is checked
between readings, so a read that itself waits (`text()` on a missing target)
can take up to one more `defaultTimeout` before the last failure is reported.

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
