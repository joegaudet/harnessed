# Solid

```ts
plugins: [harnessedDecorators(), solid()] // JSX is left for Solid's compiler
```

```tsx
import { render } from '@solidjs/testing-library'

const { baseElement } = render(() => <LoginForm />)
const form = new LoginFormHarness(dom({ user: userEvent.setup(), container: baseElement }))
```

Two things to know:

- **`<Portal>` wraps its content in a `<div>`** under `body`. Reach portalled
  content by role or test id with `{ global: true }`; don't assume
  `body > [role=dialog]`.
- **Solid delegates `onClick` to the main document**, so a click inside an iframe
  never reaches a delegated handler. Use `on:click` for content rendered into a
  frame.

Vitest browser mode works with `@solidjs/testing-library`'s `render`, in the real
browser.
