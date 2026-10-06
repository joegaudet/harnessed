# @harnessed-ts/page

One test object per screen: what it is composed of, how to know it has arrived,
and — when it has a URL — how to get there. Runs under every driver; only `goto()`
and the URL members need one that can navigate.

```ts
@Harness({ host: testId('page-checkout') })
class CheckoutPage extends PageHarness<{ token: string }> {
  override get path() {
    return '/checkout?token=$token'
  }

  @ChildHarness(CartHarness) accessor cart!: CartHarness

  protected async waitForReady() {
    await this.self.waitFor('visible')
  }

  async placeOrder(): Promise<ConfirmationPage> {
    await this.cart.checkout()
    return this.transitionTo(ConfirmationPage)
  }
}

// a browser
await new CheckoutPage(pw(page)).goto({ token })

// jsdom — rendered by the test, then awaited
render(<App />)
const checkout = new CheckoutPage(dom({ user }))
await checkout.expectReady()
```

The type parameter declares the path's params, so `goto()` is checked against the
path. A page with no `path` is reached by interaction; `transitionTo()` returns
the next page once it is ready.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
