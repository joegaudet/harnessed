# Plan: `should` on the harness member

Supersedes decision #1 and the first non-goal of `should-assertions.md`. The subject
comes first and `should` follows it, as it does on a target (`form.errorLine.should`):

```ts
await form.error.should.be.null() // the preferred form: a zero-arg reading, loosely typed
await form.error().should.be.null() // a called reading, fully typed
await form.cell(2, 'name').should.equal('2:name')
await form.errorLine.should.readAs(/credentials/) // unchanged
await form.should.be.absent() // unchanged: the harness's own host
```

`form.should.error…` (the member lookup on `form.should`) is removed in 0.10.

## Decisions

| #   | Topic        | Decision                                                                                                  |
| --- | ------------ | --------------------------------------------------------------------------------------------------------- |
| 1   | Spellings    | Both `form.error.should` and `form.error().should`                                                        |
| 2   | Old form     | `form.should.<member>` removed in 0.10 (pre-1.0 minor). `form.should.<matcher>` on the host stays         |
| 3   | Runtime hook | `ScopedHarness`'s constructor returns a Proxy when `@harnessed-ts/should/register` is loaded, else `this` |
| 4   | Types        | `form.error().should` is typed by the method; `form.error.should` is `ValueAssertion<any>`                |
| 5   | Preferred    | `form.error.should` is the form the docs lead with; `form.error().should` is the typed alternative        |
| 6   | Actions      | No runtime guard against re-running an action under retry; the docs warn, next to the short form          |
| 7   | Chai clash   | The global declarations stay in `register`. If the Chai gate fails, add an opt-out entry (see Risks)      |

### Why the types split (verified with tsc 6.0.3)

Harnesses are built with `new FormHarness(env)`, and a `new` expression always has the
class's own instance type, so no factory can map it. Two ways to type `form.error.should`
both fail:

- `interface Function { readonly should: ShouldOf<this> }`: here `this` is `Function`,
  not the method's signature, so the result is `never`.
- `interface FormHarness extends Shoulds<FormHarness> {}`: "recursively references
  itself as a base type".

`interface Promise<T> { readonly should: ValueAssertion<Awaited<T>> }` does type
correctly, so the called form checks the expected value against the method's type.

**Found while building:** a conditional there (`[void] extends [Awaited<T>] ? never : …`,
to leave actions out) makes `Promise` invariant in `T` across the whole program:
`Promise<void>` stopped being a `Promise<unknown>` in chai, gherkin, mock and tsup's own
types. So the declaration is unconditional, and neither form refuses an action at
compile time. `ValueAssertion<Unchecked>` (an explicit union, since the repo bans
`any`) types the short form.

## Runtime design

### The harness proxy (`packages/should/src/member.ts`, new)

- Core adds a slot next to `registerShould`: `registerHarnessWrapper(wrap)`. The
  `ScopedHarness` constructor ends with `return (globals().wrapHarness?.(this) ?? this) as this`.
  Without the should package nothing is proxied, so core still costs nothing.
- `get(target, prop, receiver)` reads with `Reflect.get(target, prop, receiver)`. When
  the value is a method (a string key, not `constructor`, not `_`-prefixed, not
  `elementBy`/`childHarness`), it returns a **wrapper** that is cached per
  (instance, name) in a `WeakMap`, so `form.error === form.error`.
- **The receiver, not the target, is `this`.** The proxy is returned from the base
  constructor, so a subclass's `#private` fields are installed on the proxy. That is
  the opposite of `withSteps`, which wraps after construction and binds to the target.
- The wrapper:
  - `wrapper.should`: `valueChain('FormHarness.error()', 'FormHarness.error.should', () => method.apply(receiver))`.
  - `wrapper(...args)` calls the method and returns its **native** promise with a
    non-enumerable own `should`: a value chain whose first attempt reuses that
    in-flight promise and whose retries call the method again with the same args. No
    Promise subclass, so `await`, species and `instanceof Promise` behave as before.
- `this.error()` inside a harness also goes through the proxy, which is harmless: the
  caller gets the same native promise.

### What goes away in `chain.ts`

`harnessChain`'s member fallback, `methodLink` and `isTarget`. `harness.should` becomes
`targetChain(harness, 'FormHarness.should')`. In `types.ts`, `Asserted`, `HarnessShould`
and `Reserved` go away, and `ScopedHarness.should` is typed `TargetAssertion`. A member
named like a chain word (`has`) no longer needs reserving, so the `has` fixture's purpose
changes to "a member named `has` is asserted on as usual".

### Types (`packages/should/src/register.ts`)

```ts
declare global {
  interface Promise<T> {
    /** On a harness reading: asserts on what it resolves to. */
    readonly should: ValueAssertion<Awaited<T>>
  }
  interface Function {
    /** On a zero-arg harness method. Doesn't type-check expected values or exclude actions. */
    readonly should: ValueAssertion<any>
  }
}
```

## Risks

- **Chai's `should` typings.** `@types/chai` declares `Object.should: Chai.Assertion`. Our
  `Promise` and `Function` declarations shadow it for promises and functions, which
  breaks the typing of `fn.should.throw()` and chai-as-promised's
  `promise.should.eventually`. At runtime the reading promises and wrappers carry their own
  `should` and everything else still reaches Chai's. Gate: `packages/chai` tests must
  typecheck. The globals stay in `register`, because without the `Function` declaration
  `form.error.should` doesn't compile. If the gate fails, add
  `@harnessed-ts/should/register-scoped` for suites that also use Chai's `should`: it
  types only `ScopedHarness.should` and `Query.should`, and those suites use the called
  form.
  **Found while building:** the gate failed (checked with a probe compile; the tools
  typecheck is one program, so it can't hold the check permanently), and
  `register-scoped` and `bdd/register-scoped` now exist. The global declarations live
  in `src/globals.ts`, which only the unscoped registers import.
- **The loose form allows actions.** `form.submitIt.should.be.undefined()` compiles, and
  under Cypress retry it would click again on each attempt. At runtime, an action can't be
  told apart from a reading that resolves `undefined`, so there is no guard: the docs warn
  next to the short form.
- **Promises that aren't harness readings.** Their type claims `should`, but at runtime it
  is `undefined` (or Chai's). Accepted for typing; documented.
- **`withSteps` (storybook).** Its proxy wraps ours and returns its own async wrapper,
  which has no `should`. Fix: it forwards `should` from the inner wrapper and, on a
  call's result, reads afresh outside the step. **Found while building:** its step
  labels read parameter names from the method's source to mask secrets, and the wrapper's
  source is `(...args)`, so passwords showed. Core's `markWrapped`/`unwrapMethod` let it
  read the original. It also turned `harness.should` itself into a call wrapper, which
  broke `form.should.be.absent()` under storybook on main; `should` now passes through.
- **Proxy identity.** `harness instanceof FormHarness`, `constructor.name` and
  `Object.keys` all pass through. Anything that keys a `WeakMap` by harness sees only
  the proxy, consistently, because the constructor returns it.

## Steps (TDD: each test written red first)

1. **Core hook.** Test that a harness is the object `wrapHarness` returned, and is `this`
   when nothing is registered. Add `registerHarnessWrapper` and the constructor return.
2. **Zero-arg wrapper.** Port `should.test.ts` "value assertions on a harness method" to
   `form.error.should…` and `form.error().should…`, with the failure messages unchanged
   (`expected FormHarness.error() to be null, but it was "Bad credentials"`).
3. **Args, identity, private fields.** `form.cell(2, 'name').should.equal('2:name')`.
   `form.error === form.error`. A subclass with a `#private` field and a getter reading
   it works through the proxy. The in-flight promise is reused: `calls` goes up by one on
   a pass.
4. **Retry.** Under `configure({ retryAssertions: true })`, a called reading re-runs with
   the same args until it passes.
5. **Remove the member form.** `form.should.error` throws `"error" is not a should
assertion` and the type test expects an error. `form.should.be.absent()` still works.
6. **Types.** Rewrite `types.test.ts`: the typed called form, the expected-value type
   errors, an action's promise having no `should` (via `never`), and the loose form
   compiling.
7. **BDD vocabulary.** `bdd.test.ts` on both spellings; `bdd/register` merges into
   `ValueAssertion` as before.
8. **Chai coexistence.** `packages/chai/tests/chai-should.test.ts`, at runtime and under
   typecheck (see Risks).
9. **Storybook.** A `withSteps` test with `form.error.should` and `form.cell(1).should`.
10. **Cypress.** `test-apps/cypress-e2e/cypress/e2e/should.cy.ts` on the new spellings,
    retrying.
11. **Conformance.** `packages/conformance/specs/catalog.ts` should specs on the new
    spellings, under every driver.
12. **ESLint `await-should`.** Tests for `form.error.should.be.null()` and
    `form.cell(2).should.equal(x)` un-awaited; the callee walk must pass through a
    `CallExpression` object.
13. **Docs.** About 68 `should` lines across `docs-app/app/templates/**`, `README.md`,
    `packages/should/README.md` and `docs/site/`. Lead with `form.error.should`. Show
    `form.error().should` for methods with arguments and wherever the typed check
    matters, warn that the short form doesn't type-check expected values or exclude
    actions, and drop `form.should.<member>`. Mark `should-assertions.md` #1 as
    superseded.
14. **Release.** Changeset: `minor` for should (breaking: member lookup removed) and
    core (constructor hook); `patch` for storybook, cypress and eslint-plugin.
    Gates: the repo's lint, typecheck (`typecheck:tools` included) and test scripts.

## Open questions

None. Decisions 5–7 resolved them.
