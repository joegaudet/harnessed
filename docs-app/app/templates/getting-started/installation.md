# Installation

```bash
npm i -D @harnessed-ts/core

# plus the driver(s) you use
npm i -D @harnessed-ts/dom             # Testing Library / jsdom
npm i -D @harnessed-ts/playwright      # Playwright
npm i -D @harnessed-ts/ember           # Ember: ember-qunit, ember-exam, Vitest
npm i -D @harnessed-ts/cypress         # Cypress: e2e and component tests
npm i -D @harnessed-ts/webdriverio     # WebdriverIO 10
npm i -D @harnessed-ts/vitest-browser  # Vitest browser mode
npm i -D @harnessed-ts/puppeteer       # Puppeteer
npm i -D @harnessed-ts/testcafe        # TestCafe
npm i -D @harnessed-ts/nightwatch      # Nightwatch 3: e2e and component tests
npm i -D @harnessed-ts/angular         # Angular 21+, zoneless: TestBed or a bootstrapped app
npm i -D @harnessed-ts/page            # page objects: screens composed of harnesses
npm i -D @harnessed-ts/gherkin         # Gherkin: world, page registry, {page}

# plus the assertion style your runner uses, if it is not `expect.extend`-based
npm i -D @harnessed-ts/qunit        # assert.harness(x) — ember-qunit, QUnit
npm i -D @harnessed-ts/chai         # expect(x).to.be.absent — Mocha, Cypress
```

`@harnessed-ts/core` depends on no driver. A jsdom-only project never resolves
Playwright, and a Cypress project never resolves Puppeteer. Each runner's page
under Runners lists exactly what it needs.

## Required setup

Standard decorators and `accessor` fields are the authoring surface, and they need
two things.

**1. Three compiler options.** Extend the shipped config to get them:

```jsonc
// tsconfig.json
{
  "extends": "@harnessed-ts/core/tsconfig.json",
  // → target: ES2022, useDefineForClassFields: true, lib includes ESNext.Decorators
}
```

**2. A transform that lowers them.** No JavaScript runtime can parse `accessor`
yet, and Vite's default transform passes it through untouched. Add the plugin
first in the list:

```ts
import { harnessedDecorators } from '@harnessed-ts/core/vite'

export default defineConfig({
  plugins: [harnessedDecorators(), react()],
})
```

Both your Vite config and your Vitest config need it. Playwright's own transform
handles decorators already, so its config does not. Without Vite, the same
lowering comes as a loader: `node --import @harnessed-ts/core/register` for
node:test, and the `@harnessed-ts/core/bun` preload for `bun test` (see
[node:test](../runners/node-test.md) and [Bun](../runners/bun.md)).

> Omitting either step fails at runtime, not at typecheck: every decorated field
> becomes a syntax error or silently loses its getter.

**Ember, and any app compiled by Babel with legacy decorators.** Your app's
`@tracked`, `@service` and `@action` only work with the legacy transform, so it
cannot switch wholesale. `@harnessed-ts/core/babel` claims harness files only —
`*.harness.*` and `*.page.*` files, and anything under a `harness/` or
`harnesses/` directory, matched against the path relative to the Babel root —
and compiles them with the standard transform before the app's own decorator
plugins see them. Everything else is left alone. List it first:

```js
// babel.config.cjs — Embroider + Vite (the Ember 6+ blueprint)
module.exports = {
  plugins: [
    require.resolve('@harnessed-ts/core/babel'),
    // …the blueprint's plugins, decorator-transforms among them
  ],
}

// ember-cli-build.js — classic builds
const app = new EmberApp(defaults, {
  babel: { plugins: [require.resolve('@harnessed-ts/core/babel')] },
})
```

```bash
npm i -D @babel/plugin-proposal-decorators @babel/plugin-transform-typescript @babel/plugin-transform-class-static-block
```

Babel 7.24 or later. If your harnesses live elsewhere, or your app's own
legacy-decorated files happen to use one of those names, pass
`[require.resolve('@harnessed-ts/core/babel'), { include: ['tests/pages/'] }]` —
strings match as substrings of the root-relative path; RegExps work too.

Type-checking needs the same split: an Ember `tsconfig.json` sets
`experimentalDecorators`, under which `accessor` fields cannot be decorated. Give
the harness directory a project of its own and reference it from the app's, then
check with `ember-tsc --build` (or `tsc --build`):

```jsonc
// tests/harness/tsconfig.json
{
  "extends": "@harnessed-ts/core/tsconfig.json",
  "compilerOptions": { "composite": true, "emitDeclarationOnly": true, "outDir": "../../tmp/harness-types" },
  "include": ["**/*.ts"],
}

// tsconfig.json — the app's
{ "exclude": ["tests/harness"], "references": [{ "path": "./tests/harness" }] }
```
