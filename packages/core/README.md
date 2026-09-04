# @harnessed/core

The driver-free core: `Query`, `Selector`, `ComponentHarness`, the decorators, the
driver registry, `configure()`, the matcher implementations, and the Vite plugin
that lowers standard decorators.

Depends on no driver. Install a driver alongside it —
[`@harnessed/dom`](https://www.npmjs.com/package/@harnessed/dom) or
[`@harnessed/playwright`](https://www.npmjs.com/package/@harnessed/playwright).

```jsonc
// tsconfig.json — the three options decorators need
{ "extends": "@harnessed/core/tsconfig.json" }
```

```ts
// vite.config.ts / vitest.config.ts — the transform they need
import { harnessedDecorators } from '@harnessed/core/vite'
export default defineConfig({ plugins: [harnessedDecorators(), react()] })
```

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
