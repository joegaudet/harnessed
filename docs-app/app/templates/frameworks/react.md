# React

React needs no adapter. A harness queries the DOM, so the same class drives a
React component under every runner that renders one. The conformance fixture in
`packages/conformance/fixture` is a React app, and every runner except Ember's
runs the catalog against it.

```tsx
// jsdom, via Testing Library
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { dom } from '@harnessed-ts/dom'

render(<LoginForm />)
const form = new LoginFormHarness(dom({ user: userEvent.setup() }))
await form.signInAs('ada@example.com', 'hunter2')
expect(await form.error()).toBeNull()
```

```ts
// a real browser, via Playwright: the same harness class
import { pw } from '@harnessed-ts/playwright'

const form = new LoginFormHarness(pw(page))
await form.signInAs('ada@example.com', 'hunter2')
await expect(form).toBeAbsent()
```

## Where React runs

| Runner                                              | How it mounts React                      |
| --------------------------------------------------- | ---------------------------------------- |
| [Testing Library](../runners/testing-library.md)    | `render()` from `@testing-library/react` |
| [Vitest browser mode](../runners/vitest-browser.md) | in a real browser, through the provider  |
| [Playwright](../runners/playwright.md)              | against your built or served app         |
| [Cypress](../runners/cypress.md)                    | e2e, or `cy.mount` in component testing  |
| [Nightwatch](../runners/nightwatch.md)              | e2e, or its component testing            |
| [Storybook](../storybook-and-bdd/storybook.md)      | as stories, with the harness in `play()` |

Every runner needs the decorator setup in
[Installation](../getting-started/installation.md#required-setup).
