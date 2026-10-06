# @harnessed-ts/testcafe

TestCafe driver for `@harnessed-ts/core`. Lookups run the shared resolver
(`@harnessed-ts/resolve`) inside the page, so roles, labels, strictness, absence
and frames mean exactly what they mean under the Testing Library driver;
TestCafe performs the clicks and the typing.

```ts
import { testcafe } from '@harnessed-ts/testcafe'

fixture('login').page('http://localhost:3000/login')

test('signs in', async t => {
  const form = new LoginFormHarness(testcafe(t))
  await form.fillIn({ email: 'ada@example.com', password: 'hopper' })
  await form.submit()
  await t.expect(await form.errorText()).eql(null)
})
```

No client scripts or hooks to set up: the driver installs the resolver in each
page the first time a harness touches it. Pages work too — `goto()` resolves a
relative path against the current page, or against `testcafe(t, { baseUrl })`.

There is no `/matchers` entry, because TestCafe asserts with `t.expect`. Await
the harness and assert on the value, or use `@harnessed-ts/chai`.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
