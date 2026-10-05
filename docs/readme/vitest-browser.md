## Using with Vitest browser mode

```bash
npm i -D @harnessed-ts/core @harnessed-ts/vitest-browser @testing-library/dom
npm i -D @vitest/browser-playwright vitest-browser-react   # or your provider and renderer
```

The test runs in the browser beside your components, so harnesses resolve in the
page with the same resolver as the dom driver, and act through the provider's
`userEvent`: Playwright's click, fill and select, with real events.

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [harnessedDecorators(), react()],
  test: {
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
})
```

```tsx
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import '@harnessed-ts/vitest-browser/matchers'
import { render } from 'vitest-browser-react'

await render(<LoginForm />)
const form = new LoginFormHarness(vitestBrowser())
await form.signInAs('ada@example.com', 'hunter2')
expect(await form.error()).toBeNull()
```

`vitestBrowser({ container })` scopes queries to one tree; the default,
`document.body`, is where portals land.

Differences from the dom driver:

- **`isVisible()`** is Playwright's layout check: a non-empty box that `visibility`
  does not hide. `opacity: 0` reads as visible here and hidden under jsdom.
- **Actions wait for actionability**, as Playwright's do: clicking a disabled or
  hidden element waits, then fails, rather than acting at once.
- **Frames need the Playwright provider.** A framed element is reached through
  `page.frameLocator()`, which only that provider implements.
- **No navigation.** This is component testing, like the dom driver: a page's
  `goto()` and URL members are refused; `urlFor()` still works.
- The driver adds one locator method, `harnessedSelector`, through
  `locators.extend`, to chain into frames. It is not meant for tests.
