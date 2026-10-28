# @harnessed-ts/angular

Angular driver for `@harnessed-ts/core`. Queries resolve through the shared
resolver, so they agree with every other driver; interactions go through
user-event, as in the Testing Library driver, and each one returns once the app
is stable.

```ts
import { angular } from '@harnessed-ts/angular'
import { render } from '@testing-library/angular/zoneless'

// a component test, through TestBed or @testing-library/angular
const { fixture } = await render(LoginForm)
const form = new LoginFormHarness(angular({ fixture }))
await form.signInAs('ada@example.com', 'hunter2')

// with the router provided, a page's goto() drives it
const checkout = new CheckoutPage(angular({ fixture }))
await checkout.goto({ token })

// an app bootstrapped without TestBed
const app = await bootstrapApplication(App, appConfig)
const page = new CheckoutPage(angular({ app }))
```

Zoneless, standalone components, Angular 21 and later. Runs under Vitest with
jsdom or in browser mode, and anywhere else TestBed does.

## The env

| Option    | What it is                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `fixture` | A `ComponentFixture`. Every action ends at `fixture.whenStable()`.                                                 |
| `app`     | The `ApplicationRef` from `bootstrapApplication()`, for an app with no fixture. Actions end at its `whenStable()`. |
| `root`    | Where queries start, scoped and `{ global: true }` alike. Defaults to `document.body`.                             |

One of `fixture` or `app` is required. The driver does not look for an app on
its own: the `ng` global and `getAllAngularRootElements()` exist only in
development builds, and testabilities only where zone.js is loaded.

**What "stable" means.** Zoneless, an event handler that sets a signal schedules
change detection rather than running it. `whenStable()` waits for that render,
and for anything else the app registers as pending: a navigation, an
`HttpClient` request, work wrapped in `PendingTasks.run()`. It does not wait for
a bare `setTimeout`, which a zoneless app does not track.

## Navigation

`goto()` and the URL members go through the app's `Router`, when one is
provided (`provideRouter()` or `RouterModule.forRoot()`): `goto()` is
`router.navigateByUrl()` then `whenStable()`, and `currentUrl` is
`Location.path()`. That is not `window.location`: TestBed swaps in a mock
platform location, so a test's navigations never reach the address bar.

Without a router, a page still constructs and reads, but `goto()` and the URL
members refuse with `the "angular" driver cannot navigate`. With one, they
refuse until its first navigation rather than reading as `/` — TestBed performs
no initial navigation.

## Where Angular differs from the other drivers

- **`isVisible()`** is a layout check in a real browser, as under Playwright,
  and the dom driver's computed-style check under jsdom, which lays nothing out.
- **`boundingBox()`** under jsdom is all zeros, as with the dom driver.
- **Queries start at `document.body`**, where TestBed attaches each fixture and
  where CDK overlays render, so `{ global: true }` reaches them.

## Decorators: two kinds in one app

Angular's components compile with the legacy `experimentalDecorators` transform.
Harnesses use standard decorators and `accessor` fields. Keep them apart by file
name — `*.harness.ts` and `*.page.ts` — in both the build and the typecheck.

**Vite, through `@analogjs/vite-plugin-angular`.** `harnessedDecorators()` first,
claiming harness and page files only, and the Angular plugin told to leave them
alone — it emits each file from its own TypeScript program, so it would
otherwise replace the lowered harness with a legacy build of it:

```ts
import angular from '@analogjs/vite-plugin-angular'
import { harnessedDecorators } from '@harnessed-ts/core/vite'

const HARNESS_FILES = /\.(harness|page)\.ts$/

export default defineConfig({
  plugins: [
    harnessedDecorators({ include: HARNESS_FILES }),
    angular({ transformFilter: (_code, id) => !HARNESS_FILES.test(id) }),
  ],
})
```

**Two tsconfigs.** The app's keeps `experimentalDecorators` and excludes harness
and page files; a second one checks them, and the tests that use them, without
it. Angular's own decorators type-check under both, so a harness may import the
component it drives.

```jsonc
// tsconfig.app.json — checked with `ngc -p tsconfig.app.json --noEmit`
{
  "compilerOptions": { "experimentalDecorators": true /* …the CLI's options */ },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.harness.ts", "src/**/*.page.ts"],
}

// tsconfig.harness.json — checked with `tsc -p tsconfig.harness.json`
{
  "extends": "@harnessed-ts/core/tsconfig.json",
  "compilerOptions": { "noEmit": true, "strict": true, "moduleResolution": "bundler" },
  "include": ["src/**/*.harness.ts", "src/**/*.page.ts", "src/**/*.spec.ts"],
}
```

Under Vitest, load `@angular/compiler` in a setup file: Angular's packages ship
partially compiled, and Vitest loads them without the linker a build runs.
Without Vitest globals, also call `getTestBed().resetTestingModule()` in an
`afterEach`; TestBed registers that itself only where `afterEach` is a global.

## Compared with `@angular/cdk/testing`

The CDK's component harnesses are the closest thing Angular has, and they are a
good fit for what they are for: harnesses that ship with an Angular component
library, run through `TestbedHarnessEnvironment` or a WebDriver environment.
They are Angular-only by design — they find components by their Angular
selectors and stabilize through Angular.

harnessed harnesses query the DOM — roles, labels, test ids — so one harness
runs unchanged under Testing Library, Playwright, Cypress, WebdriverIO,
Puppeteer, TestCafe, Vitest browser mode and Storybook, against an Angular app
or any other. Every driver is held to one conformance catalog. Pick the CDK to
publish harnesses for an Angular component library's users; pick harnessed to
write a harness once and run it at every level of your own app's tests. The two
do not interoperate, and can sit side by side in one suite.

Full guide: the
[harnessed README](https://github.com/joegaudet/harnessed#using-with-angular).

MIT © Joe Gaudet, Jay Seo
