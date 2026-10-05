## Using with Cypress

```bash
npm i -D @harnessed-ts/core @harnessed-ts/cypress @harnessed-ts/chai \
  @testing-library/dom @testing-library/user-event
```

Register the commands and the Chai assertions in your support file
(`cypress/support/e2e.ts`, or `component.ts` for component tests):

```ts
import '@harnessed-ts/cypress/support'
import { harnessedChai } from '@harnessed-ts/chai'

chai.use(harnessedChai) // Cypress bundles Chai; this adds absent, selected, readAs
```

Cypress commands are enqueued, not awaited, and a promise cannot enqueue one. So a
harness runs inside a single command, as ordinary promises against the
application under test:

```ts
it('signs in', () => {
  cy.visitPage(LoginPage) // cy.visit(page.urlFor()), then waits for expectReady()
  cy.harness(LoginFormHarness, async form => {
    await form.fillIn({ email: 'ada@example.com', password: 'hopper' })
    await form.submitIt()
    await expect(form).to.readAs(/Welcome/)
  })
})
```

- `cy.harness(Cls, fn?, options?)` constructs the harness and awaits `fn`,
  yielding what it resolves to; without `fn` it yields the harness.
  `cy.harnessEnv(env => …)` hands you the env to build several at once. Each
  harness action is written to the command log.
- `options.timeout` covers the whole callback. It defaults to four times
  `defaultTimeout`, since one flow is several waits in a row.
- Inside the callback, use `await` and harness methods only — never `cy.*`.
- `cy.visitPage(Page, params?)` is the Cypress-native way in. In e2e tests,
  `page.goto()` also works inside the callback. In component tests it refuses,
  because the spec frame is the page.
- Component tests: `cy.mount(<LoginForm />)`, then `cy.harness(LoginFormHarness, …)`.
  Mount with `cypress/react`. If you compile your own harnesses, add
  `harnessedDecorators()` from `@harnessed-ts/core/vite` to the dev server's Vite
  config.

**Differences under Cypress:**

- **Interactions** are `@testing-library/user-event` events by default:
  synthetic, with `isTrusted` false, in every browser.
- **Trusted input.** Pass `{ realEvents: true }` to get real browser input through
  the Chrome DevTools Protocol. This covers click, hover, fill, clear, check and
  press. It needs a Chromium-family browser (Chrome, Edge or Electron) and is
  refused by name elsewhere.
- **`selectOption` under `realEvents`** still goes through user-event, because
  CDP input cannot operate a native `<select>` popup.
- **`press` under `realEvents`** takes single characters and the named keys
  (Enter, Tab, arrows and so on), not chords.
- **`isVisible()`** is a layout check, as under Playwright: a non-empty box and
  not `visibility: hidden`. An `opacity: 0` node counts as visible.
- **Frames** are entered when they are same-origin only, as under the dom
  driver.
