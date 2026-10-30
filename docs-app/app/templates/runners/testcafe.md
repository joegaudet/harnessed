# TestCafe

```bash
npm i -D @harnessed-ts/core @harnessed-ts/testcafe testcafe typescript
```

Build the env from the test's controller — the `t` the test function is
handed, not the `t` exported by `'testcafe'`, which belongs to no one test and
is refused. There is nothing else to wire: the driver installs the shared
resolver in each page the first time a harness touches it.

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
- **`fill()` and `clear()`** refuse what TestCafe's `typeText` would get
  silently wrong: an element that is not an `<input>`, `<textarea>` or
  `[contenteditable]` (rather than typing into whatever it contains), an
  `<input>` that takes no text, such as a checkbox (as Playwright's `fill()`
  does), and, once the timeout runs out, a disabled, `aria-disabled` or
  readonly control.
- **`press()`** takes Playwright's key names and chords. TestCafe has no
  function or numpad keys, so `press('F5')` throws before anything is sent.
  `ControlOrMeta` follows the browser's `navigator.platform`, not the test
  runner's.
- **`isVisible()`** uses the shared layout rule: a non-empty box that
  `visibility` does not hide, and content inside a hidden frame is hidden.

**Mocking:** `mock(testcafe(t))` from `@harnessed-ts/testcafe/mock`, inside the test — see [Mocking APIs](../mocking/mocking-apis.md).
