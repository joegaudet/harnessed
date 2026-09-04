# @harnessed/eslint-plugin

Five rules that turn the harness authoring conventions into a gate.

```js
import harnessed from '@harnessed/eslint-plugin'
export default [harnessed.configs.recommended] // or .strict
```

- `no-page-or-screen-in-harness` — the one violation that silently destroys the
  abstraction. Exempts a route's `waitForReady()`.
- `require-host` — a concrete harness with no `@Harness({ host })`
- `require-wait-for-ready` — a route with a missing or empty readiness check
- `no-reach-through-cast` — `(harness as unknown as { page }).page`
- `no-raw-locator-in-test` — a raw locator where a harness should be used

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
