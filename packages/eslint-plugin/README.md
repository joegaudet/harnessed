# @harnessed-ts/eslint-plugin

Six rules that turn the harness authoring conventions into a gate.

```js
import harnessed from '@harnessed-ts/eslint-plugin'
export default [harnessed.configs.recommended] // or .strict
```

- `no-page-or-screen-in-harness` — the one violation that silently destroys the
  abstraction. Exempts a page's `waitForReady()`.
- `require-host` — a concrete harness or page with no `@Harness({ host })`
- `require-wait-for-ready` — a page with a missing or empty readiness check
- `no-reach-through-cast` — `(harness as unknown as { page }).page`
- `no-raw-locator-in-test` — a raw locator where a harness should be used
- `no-component-harness-in-test` — a test constructing a component harness
  directly instead of entering through a page. Runtime-agnostic: `testFiles`
  globs default to `*.spec.*`, `*.test.*`, `*.cy.*`, `*.steps.*`, and `steps/`;
  a file that calls `render()` or `mount()` is exempt. `strict` only.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
