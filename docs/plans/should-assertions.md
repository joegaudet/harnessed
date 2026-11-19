# Plan: should-style assertions (`@harnessed-ts/should`)

Status: draft · Base: `main` @ `68cd2c0`

## Goal

Every runner gets a should-style alternative to `expect(await …)`:

```ts
// before
expect(await form.error()).toBeNull()
// after
await form.should.error.be.null()
await form.should.error.not.be.null()
await form.submitButton.should.be.absent()
```

It ships as its own package and works the same under every driver harnessed supports
(Vitest browser, Playwright, Cypress, WebdriverIO, Nightwatch, Puppeteer, TestCafe,
node:test, bun, testing-library/dom, Ember). Failure messages for harness matchers are
the ones `harnessMatchers` already produces.

## Decisions (from the clarifying round)

| #   | Topic        | Decision                                                                                                                                       |
| --- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Attach point | A `should` getter on the harness: `form.should.error…`. Harness methods are prototype methods, so `form.error.should` cannot reach `form`      |
| 2   | Async        | The terminal call returns a Promise: `await form.should.error.be.null()`                                                                       |
| 3   | Vocabulary   | Value (null/true/false/undefined), equality (equal/eql/match/include), harness matchers (absent/selected/readAs), numeric (above/below/length) |
| 4   | Engine       | Standalone with zero runtime deps. Throws an `AssertionError` that carries `actual`/`expected`                                                 |
| 5   | Modules      | Two entry points: `@harnessed-ts/should` (harness matchers + the vocabulary in #3) and `@harnessed-ts/should/bdd` (full Chai BDD parity)       |
| 6   | Name         | `@harnessed-ts/should`, at `packages/should`                                                                                                   |
| 7   | Opt-in       | Side-effect import: `import '@harnessed-ts/should/register'` (or `/bdd/register`) in the setup file                                            |
| 8   | Raw targets  | `Query` (`@ByRole` etc. fields) gets `should` too, for the harness matchers                                                                    |
| 9   | Cypress      | Works inside `cy.harness(Cls, async form => …)`. There, terminals **retry** until `defaultTimeout`, like Cypress's own `.should`               |
| 10  | Docs         | Every runner page, a new guide page, package README + `docs/site/`, and an eslint rule                                                         |

## Design

### Chain shape

`harness.should` is a Proxy over the harness. Property access picks a member:

- **Zero-arg async method** (`form.should.error`): the chain asserts on `await form.error()`.
- **Method with args**: the chain link can be called, `form.should.cell(2, 'name').equal('Ada')`.
- **Query field** (`form.should.submitButton`): same as `form.submitButton.should`.

The chain then follows Chai's grammar: language words (`to`, `be`, `been`, `is`, `that`,
`which`, `and`, `has`, `have`, `with`, `at`, `of`, `same`), the flags `not` and `deep`,
then a terminal **call** (`null()`, not Chai's property `.null`). Calling the terminal
is what returns a Promise, so a missing `await` is visible to `no-floating-promises`.

The chain is immutable: each link returns a new state
`{ subject, path, args, flags }`. A terminal resolves the subject once, runs the check,
and throws `AssertionError(message, { actual, expected })`.

### Module layout (`packages/should/src`)

| File              | Contents                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chain.ts`        | Proxy chain, flags, language words, resolve-then-check, retry hook                                                                                                                                                 |
| `assertions.ts`   | Core vocabulary (#3). Harness matchers delegate to `harnessMatchers` in core                                                                                                                                       |
| `bdd.ts`          | Chai BDD parity: ok, empty, exist, a/an, instanceOf, property, ownProperty, keys, members, oneOf, closeTo, within, least/most, string, lengthOf, satisfy, throw/rejectedWith, frozen/sealed/extensible, NaN/finite |
| `error.ts`        | `AssertionError` with `actual`, `expected`, `showDiff`                                                                                                                                                             |
| `register.ts`     | Defines the `should` getter on `ScopedHarness.prototype` and the type augmentation                                                                                                                                 |
| `bdd/register.ts` | Same, with the bdd vocabulary added                                                                                                                                                                                |
| `types.ts`        | `Should<T>` mapped type: async methods → chains, `Query` fields → target chains                                                                                                                                    |

`bdd` builds on the core module: one chain, one place where flags are handled.

### Core change (small, needed for #8)

Queries come from per-driver factories (`createQuery` → `globals().drivers.get(...)`),
so there's no shared prototype to patch. Add one hook to core, `registerQueryExtension(fn)`,
which `createQuery` runs on each query it returns. Core keeps no knowledge of `should`.
`ScopedHarness` is already exported, so the harness getter needs nothing new from core.

### Types

`register.ts` augments `ScopedHarness` and `Query` through `declare module '@harnessed-ts/core'`.
`Should<T>` keeps only members that return a Promise or are a `Query`. A sync member,
or a private one, is a type error, so a typo fails at compile time. Terminal argument
types follow the resolved value: `equal(x: Awaited<R>)`, and `above(n)` only when `R` is `number`.

### Retry (Cypress)

The chain has a `retry` hook: `{ timeout, interval } | undefined`. It is set from the
env's capabilities, not by runner sniffing. `@harnessed-ts/cypress` sets it to
`defaultTimeout`. Other drivers leave it unset and run the terminal once. A retrying
terminal re-resolves the subject (calls the method again) on every attempt, then
reports the last failure.

> Open: should retry be opt-in for the other drivers too (`{ retry: true }` in config)?
> The plan leaves it Cypress-only, as asked, but builds the hook so any driver can turn it on.

## Phases

Each phase is TDD: failing test first, then implement. Each ends with the CONTRIBUTING.md
gate green (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`).

1. **Scaffold the package.** Copy `packages/chai` as the template (tsup, vitest, tsconfig
   references), then add it to the root `typecheck:packages`, `test:units`, and the
   changeset config.
2. **Chain + core vocabulary.** Unit tests in `packages/should/tests` against a fake
   harness: each terminal passes and fails, `.not` works, the message plus
   actual/expected are right, a chain link with args works, a missing await is caught
   by types and lint. Harness matchers assert that their messages equal what
   `harnessMatchers` returns.
3. **Core hook + register.** `registerQueryExtension` in core, with a unit test.
   `register.ts` and the type augmentation, with a `tsd`/`expectTypeOf` type test file.
4. **bdd module.** A port of Chai's BDD test cases (adapted to terminal calls), so
   parity is checked, not claimed.
5. **Conformance.** Add a `should` spec to `packages/conformance` that runs under every
   driver with no per-driver opt-out, the same as the existing catalog. Add a parity
   check: every key of core `harnessMatchers` has a `should` terminal, so a new
   matcher can't ship without one.
6. **Cypress.** Wire the retry capability in `@harnessed-ts/cypress`. e2e and component
   specs cover: passes once the DOM settles, fails after `defaultTimeout` with the last
   message, and gives the same result through `cy.harness` in both e2e and component mode.
7. **ESLint rule** `await-should`: flags an un-awaited `.should…()` terminal, so projects
   without type-aware linting are covered too. Lives in `packages/eslint-plugin/src/rules`,
   with tests, in the recommended config.
8. **Docs.**
   - `docs-app/app/templates/writing-harnesses/should-assertions.md`: the new page.
     Covers opt-in, the chain grammar, the full vocabulary of both modules, async rules,
     the Cypress retry, and when to prefer `expect`. Add it to `meta.json`.
   - Every `runners/*.md` page gets a "Should style" block next to its expect example,
     showing that runner's setup-file import. Cypress shows it inside `cy.harness`.
   - `writing-harnesses/matchers.md`: link the should form of each matcher.
   - `packages/should/README.md`, plus the root README package list.
   - `docs/site/`: package list and one snippet (per CLAUDE.md, same PR; tick the Website box).
9. **Release.** Add a changeset (`minor` for should, `minor` for core's new hook, `patch`
   for cypress and eslint-plugin). Publish through `/oss-release`.

## Non-goals

- `form.error.should` (should hung off the method itself). It would need a Proxy on
  every harness instance; we chose the getter instead.
- Patching `Object.prototype` / `Function.prototype` the way `chai.should()` does.
- A `cy.*` command that asserts outside the `cy.harness` callback.
- Retry under runners other than Cypress (the hook exists; turning it on is a follow-up).

## Risks

- **The Proxy chain vs. tooling.** Proxies confuse some devtools and `util.inspect`.
  Give the chain a `toString` / `Symbol.toStringTag` that prints the path (`form.should.error.not`).
- **Name collision.** If a harness already defines a `should` member, the getter would
  shadow it. `register` throws a clear error the first time that harness is used.
  `harness-public-surface` lint can reserve the name.
- **bdd parity drift.** The Chai port tests in phase 4 are the guard. Pin the Chai
  version they were ported from in the test file header.
