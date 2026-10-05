### Using with TestCafe

```bash
npm i -D @harnessed-ts/core @harnessed-ts/testcafe testcafe typescript
```

Build the env from the test's controller. There is nothing else to wire: the
driver installs the shared resolver in each page the first time a harness
touches it.

```ts
import { testcafe } from '@harnessed-ts/testcafe'

fixture('checkout').page('http://localhost:3000/cart')

test('applies a coupon', async t => {
  const cart = new CartPage(testcafe(t, { baseUrl: 'http://localhost:3000' }))
  await cart.coupon.apply('SAVE10')
  await t.expect(await cart.total.text()).eql('$90.00')
  await t.expect(await cart.coupon.errorText()).eql(null)
})
```

TestCafe compiles your `.ts` files itself, with a bundled TypeScript 4.9 that
predates standard decorators and pins `target` to ES2016. Point it at your own
TypeScript (5.0 or later) and turn legacy decorators off, so harnesses compile
the way they do everywhere else:

```js
// .testcaferc.cjs
module.exports = {
  compilerOptions: {
    typescript: {
      customCompilerModulePath: require.resolve('typescript'),
      options: { experimentalDecorators: false, emitDecoratorMetadata: false },
      // TypeScript 6 also needs: ignoreDeprecations: '6.0'
    },
  },
}
```

Assert with `t.expect` on awaited values, or with `@harnessed-ts/chai`; there
is no `/matchers` entry. Documented differences:

- **Frames** are entered from the page's own document, as under the dom driver:
  same-origin only. An action inside a frame switches TestCafe into each iframe
  and always back to the main window, so do not hold a manual
  `t.switchToIframe()` across a harness call.
- **`currentUrl`** is synchronous and TestCafe reads the page asynchronously, so
  it reports the URL as of the last harness call, action or `goto()` — not a
  navigation the page made on its own since. `assertPathname()` polls and is
  always current.
- **`goto()`** resolves a relative path against `baseUrl` when the env has one,
  and otherwise against the page the test is on.
- **`selectOption()`** sets the selection and dispatches `input` and `change`,
  as Playwright does, rather than clicking through a native dropdown.
- **`isVisible()`** uses Playwright's definition: a non-empty box and not
  `visibility: hidden`, and content inside a hidden frame is hidden.
