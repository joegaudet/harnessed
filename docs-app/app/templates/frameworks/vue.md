# Vue

Nothing about a harness changes. Render with `@testing-library/vue` and build the
env as for any Testing Library test:

```ts
// vite.config.ts / vitest.config.ts: harnessedDecorators() first
plugins: [harnessedDecorators(), vue()]
```

```ts
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/vue'

const { baseElement } = render(LoginForm)
const form = new LoginFormHarness(
  dom({ user: userEvent.setup(), container: baseElement as HTMLElement }),
)
await form.signInAs('ada@example.com', 'hunter2')
```

`<Teleport to="body">` content is reachable from a `{ global: true }` field. In
Vitest browser mode, `await render(LoginForm)` from `vitest-browser-vue`, then
`vitestBrowser({ container: baseElement })`. Vue does not add `px` to numbers in
a style object, so write `'12px'` where a layout depends on it.
