# @harnessed-ts/cypress

Cypress driver for `@harnessed-ts/core`, for e2e and component tests. Cypress
commands are enqueued rather than awaited, so a harness runs inside one command —
`cy.harness` — as plain promises against the application under test.

```ts
// cypress/support/e2e.ts (or component.ts)
import '@harnessed-ts/cypress/support'
import { harnessedChai } from '@harnessed-ts/chai'
chai.use(harnessedChai)
```

```ts
cy.visitPage(LoginPage)
cy.harness(LoginFormHarness, async form => {
  await form.fillIn({ email: 'ada@example.com' })
  await expect(form).not.to.be.absent
})
```

Interactions go through `@testing-library/user-event` bound to the AUT document;
pass `{ realEvents: true }` for trusted Chrome DevTools Protocol input on
Chromium-family browsers. Never call `cy` commands inside the callback.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
