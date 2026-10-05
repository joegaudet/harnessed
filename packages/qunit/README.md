# @harnessed-ts/qunit

QUnit assertions for [harnessed](https://github.com/joegaudet/harnessed#readme)
harnesses, in the qunit-dom style. For ember-qunit and any other QUnit suite.

```ts
// tests/test-helper.ts — once, before start()
import QUnit from 'qunit'
import { install } from '@harnessed-ts/qunit'
install(QUnit)
```

```ts
test('saving shows the banner', async function (assert) {
  await page.save()
  await assert.harness(page.banner).isPresent()
  await assert.harness(page.price).readsAs(/^\$/)
})
```

| Check                              | Passes when                                   |
| ---------------------------------- | --------------------------------------------- |
| `isAbsent()` / `isPresent()`       | nothing matches / something does              |
| `isSelected()` / `isNotSelected()` | `aria-pressed="true"` / anything else         |
| `readsAs(x)` / `doesNotReadAs(x)`  | the text equals a string or matches a pattern |

Each takes a target or a harness, is async (await it), reports through
`assert.pushResult` with `actual` and `expected`, and takes an optional message
that replaces the default. The default messages are the same ones the Vitest,
Playwright and Chai assertions use.

MIT © Joe Gaudet, Jay Seo
