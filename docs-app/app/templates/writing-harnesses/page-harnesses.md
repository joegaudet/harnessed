# Page harnesses

One test object per screen: what it is composed of, how to know it has arrived,
and — when it has a URL — how to get there. A page nests component harnesses and
other pages with `@ChildHarness`, and tests enter through it.

```ts
@Harness({ host: testId('page-checkout') })
class CheckoutPage extends PageHarness<{ token: string }> {
  override get path() {
    return '/checkout?token=$token'
  }

  @ChildHarness(CartHarness) accessor cart!: CartHarness

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }

  async placeOrder(): Promise<ConfirmationPage> {
    await this.cart.checkout()
    return this.transitionTo(ConfirmationPage)
  }
}

// a real browser
const checkout = new CheckoutPage(pw(page))
await checkout.goto({ token })
const confirmation = await checkout.placeOrder()

// jsdom — the test renders the app, then waits for the page
render(<App />)
const rendered = new CheckoutPage(dom({ user: userEvent.setup() }))
await rendered.expectReady()
```

A page constructs under **every** driver: navigation is resolved lazily, so only
`goto()` and the URL members need a driver that can drive an address bar, and
under one that cannot (jsdom has no URL) they fail at call time with one readable
error.

`path` is optional. A page reached by URL overrides `get path()`; the type
parameter declares its params, so `goto()` is checked against the path rather
than trusted. Substitution is textual, so it works in the query string as well as
the path, at **every** occurrence, URL-encoded. A page reached by interaction
leaves `path` out, and `goto()` on it is a refusal, not a silent no-op.

`waitForReady()` runs behind `goto()` and `expectReady()` and must never be empty —
an empty one satisfies the abstract member and silently removes the wait, so the
failure lands somewhere unrelated later in the test. The usual body is one line
against the page's own host: `await this.self.waitFor('visible')`. With no
`{ timeout }` the wait is bounded only by what `waitForReady()` itself waits on;
an explicit one adds a second clock. `isReady()` is the non-throwing probe; pass
a short `{ timeout }`.

`transitionTo(NextPage)` is how an action returns the page it leads to: it
constructs `NextPage` with the same env and scope and awaits its readiness. A
shared app shell — nav, header, toasts — is an **abstract** page base carrying
those fields (`abstract class AppPage extends PageHarness`); each concrete page
extends it and supplies its own host.

Also provides `currentUrl`, `currentPathname`, `currentSearchParams`, and
`assertPathname()` — which waits, and compares the **pathname**, so it keeps
matching once the URL carries a query string. `urlFor(params)` returns the URL
`goto()` would visit without visiting it, for a runner that queues its own
navigation (Cypress's `cy.visit`).

`RouteHarness` in `@harnessed-ts/route` is the old name for this class. It is a
deprecated re-export for one release.
