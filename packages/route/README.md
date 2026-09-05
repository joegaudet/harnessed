# @harnessed-ts/route

One test object per URL: where it lives, how to get there, and how to know it has
arrived. Playwright only — a route needs a real page.

```ts
@Harness({ host: testId('stage') })
class CheckoutRoute extends RouteHarness<{ token: string }> {
  get path() {
    return '/checkout?token=$token'
  }
  protected async waitForReady() {
    await this.page.waitForSelector('[data-testid=cart]')
  }
}

await new CheckoutRoute(page).goto({ token })
```

The type parameter declares the path's params, so `goto()` is checked against the
path. Substitution is URL-encoded and applies at every occurrence.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
