# Svelte

```ts
// vitest.config.ts — svelteTesting() gives jsdom Svelte's browser build
plugins: [harnessedDecorators(), svelte(), svelteTesting()]
```

```ts
import { render } from '@testing-library/svelte'

const { baseElement } = render(LoginForm)
const form = new LoginFormHarness(dom({ user: userEvent.setup(), container: baseElement }))
```

Svelte 5. `harnessedDecorators()` transforms `.ts` and `.tsx` only, so `.svelte`
files go straight to the Svelte plugin. Content `mount()`ed into
`document.body` is reachable from a `{ global: true }` field. In Vitest browser
mode, `await render(LoginForm)` from `vitest-browser-svelte`.
