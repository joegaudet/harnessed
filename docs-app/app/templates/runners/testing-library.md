# Testing Library

```bash
npm i -D @harnessed-ts/core @harnessed-ts/dom @testing-library/dom @testing-library/user-event
```

Render with your framework's Testing Library, then build the env from a
user-event instance. Interactions go through user-event, queries through the
shared resolver:

```tsx
import { dom } from '@harnessed-ts/dom'
import '@harnessed-ts/dom/matchers' // toBeAbsent, toBeSelected, toReadAs
import userEvent from '@testing-library/user-event'

const { baseElement } = render(<LoginForm />)
const form = new LoginFormHarness(dom({ user: userEvent.setup(), container: baseElement }))
await form.signInAs('ada@example.com', 'hunter2')
expect(await form.error()).toBeNull()
```

`container` scopes queries to one render; the default is `document.body`, where
portals land. Add `harnessedDecorators()` to the Vitest config (see
[Required setup](../getting-started/installation.md#required-setup)). The matchers extend Vitest's `expect`; under
Jest, `expect.extend(harnessMatchers)` from `@harnessed-ts/core`.

jsdom has no layout and no address bar, so:

- **`isVisible()`** is a computed-style check (see
  [Cross-driver guarantees](../writing-harnesses/cross-driver-guarantees.md)).
- **Pages construct, but do not navigate.** Render the app, then
  `await page.expectReady()`; `goto()` and the URL members are refused.
- **Frames** are entered when they are same-origin.

**Mocking:** `mock(dom({ user }))` from `@harnessed-ts/dom/mock`, before `render` — see [Mocking APIs](../mocking/mocking-apis.md).
