# Selectors

`testId('x')`, `role('button', { name: /save/i, level: 2 })`, `label('Email')`,
`text(/expired/)`, `placeholder('you@example.com')`. Each returns a `Selector`, a
plain data description of a query.

`testId('x')` matches `data-testid="x"` by default. With
`configure({ testIdAttribute: 'data-test-*' })` it matches the
[ember-test-selectors](https://github.com/mainmatter/ember-test-selectors) style
instead: any element that has the attribute `data-test-x`, whatever its value, so
`<span data-test-productions-count>` is `testId('productions-count')`. Any prefix
ending in `*` works the same way (`data-qa-*`).

`frame(selector)` marks an `<iframe>`. Used as a host, the harness's `self` is the
iframe element and its fields resolve inside the frame's document:

```ts
@Harness({ host: frame(testId('payment-frame')) })
class PaymentFrame extends ComponentHarness {
  @ByRole('button', { name: 'Pay' }) private accessor pay!: Query
}
```

To reuse a harness written for the framed app itself, pass the iframe to
`@ChildHarness` instead — the child is unchanged:

```ts
@ChildHarness(CheckoutPage, { frame: testId('checkout-frame') }) accessor checkout!: CheckoutPage
```

Playwright enters cross-origin frames as well. The dom driver can only enter
same-origin ones; jsdom cannot load another origin's document.
