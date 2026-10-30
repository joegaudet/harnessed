# Configuration

```ts
// harnessed.config.ts
import { defineConfig } from '@harnessed-ts/core'

export default defineConfig({
  testIdAttribute: 'data-testid',
  defaultTimeout: 5000,
  layout: { components: 'src/components', pages: 'src/pages', harnesses: 'harness' },
  testIdPattern: { widget: 'ui-<kebab>', page: 'page-<kebab>' },
})
```

One place to declare these, read by everything that needs them.
`@harnessed-ts/eslint-plugin` and `@harnessed-ts/claude` load the file themselves — the
linter resolves it by walking up from the file being checked, so a monorepo and an
editor started anywhere both find the right one. `testIdAttribute` is pushed into
Testing Library and Playwright for you. It is a plain attribute name, matched by
value (`data-testid`, `data-test`), or a prefix ending in `*`, matched by presence
(`data-test-*`, for ember-test-selectors) — see [Selectors](selectors.md).

The runtime half is explicit, because your test setup already transforms
TypeScript and a bundler-free loader has no business running there:

```ts
// vitest setup file
import { applyConfig } from '@harnessed-ts/core'
import config from '../harnessed.config'

applyConfig(config)
```
