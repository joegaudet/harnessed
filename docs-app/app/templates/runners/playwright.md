# Playwright

```bash
npm i -D @harnessed-ts/core @harnessed-ts/playwright
```

Build the env from the test's `page`. Playwright's own transform compiles
decorators, so there is nothing to add to its config:

```ts
import { pw } from '@harnessed-ts/playwright'
import '@harnessed-ts/playwright/matchers' // toBeAbsent, toBeSelected, toReadAs
import { expect, test } from '@playwright/test'

test('checks out', async ({ page }) => {
  const checkout = new CheckoutPage(pw(page))
  await checkout.goto({ token: 'abc' }) // resolved against the config's baseURL
  const confirmation = await checkout.placeOrder()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
```

Queries become Locators, so waiting and strictness are Playwright's own, and
frames — cross-origin included — are entered with `frameLocator()`.
`isVisible()` is Playwright's layout check, and answers at once. For a Gherkin
suite, see [Gherkin](../storybook-and-bdd/gherkin.md); for a backend-free suite,
[`createApiStubs`](../mocking/create-api-stubs.md).

**Should style:** `npm i -D @harnessed-ts/should`, then import
`@harnessed-ts/should/register` from the test file, or the module that declares
your fixtures. Every harness and target gets a `.should`. Await each assertion:

```ts
await form.should.error.be.null() // expect(await form.error()).toBeNull()
await form.should.error.not.be.null()
await page.banner.should.be.absent() // a @ChildHarness, or form.self
```

See [Should assertions](../writing-harnesses/should-assertions.md).

**Mocking:** `mock(pw(page))` from `@harnessed-ts/playwright/mock`, before `goto()` — see [Mocking APIs](../mocking/mocking-apis.md).
