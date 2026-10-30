# Angular

```bash
npm i -D @harnessed-ts/core @harnessed-ts/angular @testing-library/dom @testing-library/user-event
```

Zoneless, standalone, Angular 21 and later. Build envs with `angular()`: queries
resolve through the shared resolver, interactions go through user-event, and
every action returns once the app is stable — `fixture.whenStable()`, or the
`ApplicationRef`'s for an app bootstrapped without TestBed:

```ts
import { angular } from '@harnessed-ts/angular'
import { render } from '@testing-library/angular/zoneless' // or TestBed

const { fixture } = await render(LoginForm)
const form = new LoginFormHarness(angular({ fixture }))
await form.signInAs('ada@example.com', 'hunter2')

// with provideRouter(): goto() drives the router
const page = new CheckoutPage(angular({ fixture }))
await page.goto({ token })

// an app bootstrapped without TestBed
const app = await bootstrapApplication(AppComponent, config)
const shell = new ShellPage(angular({ app }))
```

**Two kinds of decorators.** `@Component` needs `experimentalDecorators`;
harnesses use standard ones. Split them by file name, in the build and in the
type-check:

```ts
// vite.config.ts (and vitest.config.ts), with @analogjs/vite-plugin-angular
const HARNESS_FILES = /\.(harness|page)\.ts$/

plugins: [
  harnessedDecorators({ include: HARNESS_FILES }), // first
  angular({ transformFilter: (_code, id) => !HARNESS_FILES.test(id) }), // leaves them alone
]
```

```jsonc
// tsconfig.app.json — experimentalDecorators on, harness files out
{ "exclude": ["src/**/*.harness.ts", "src/**/*.page.ts"] }

// tsconfig.harness.json — standard decorators, harness and spec files
{ "extends": "@harnessed-ts/core/tsconfig.json", "include": ["src/**/*.harness.ts", "src/**/*.page.ts", "tests"] }
```

A harness may import an app module that uses Angular's decorators, and an app
component may sit beside a harness: `test-apps/angular/src/app/boundary/` proves
both. Under Vitest without globals, import `@angular/compiler` in a setup file
(Angular ships partially compiled) and call `getTestBed().resetTestingModule()`
in an `afterEach`.

Matchers: `import '@harnessed-ts/dom/matchers'` in the Vitest setup file
registers `toBeAbsent`, `toBeSelected` and `toReadAs` with Vitest's `expect`; they
read through the public `Query` surface, so they work on the `angular` driver's
targets too.

Where Angular differs: queries and `{ global: true }` start at `document.body`,
where CDK overlays land; `isVisible()` is a layout check in a browser and a
style check under jsdom; `whenStable()` does not wait for a bare `setTimeout`;
`goto()` and the URL members need a provided router, and refuse before its first
navigation.

**Angular CDK harnesses.** `@angular/cdk/testing` has component harnesses of its
own: Angular-only, and suited to component libraries tested under TestBed. A
harnessed harness runs unchanged under every runner and framework in the
[support matrix](../getting-started/support-matrix.md). The two
do not interoperate; pick per suite.
