# node:test

```bash
npm i -D @harnessed-ts/core @harnessed-ts/dom @harnessed-ts/chai chai esbuild \
  @testing-library/dom @testing-library/user-event jsdom global-jsdom
```

Node's own test runner, on jsdom, with harnesses loaded straight from
TypeScript. Two `--import` flags do the setup: `global-jsdom/register` installs
the DOM, and `@harnessed-ts/core/register` hands `.ts` and `.tsx` files to esbuild,
which strips the types, lowers decorators and `accessor`, and compiles JSX:

```bash
node --test --import global-jsdom/register --import @harnessed-ts/core/register "tests/**/*.test.tsx"
```

```tsx
import { harnessedChai } from '@harnessed-ts/chai'
import { dom } from '@harnessed-ts/dom'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as chai from 'chai'
import { afterEach, it } from 'node:test'

chai.use(harnessedChai)
afterEach(cleanup) // node:test has no globals, so Testing Library cannot register it

it('signs in', async () => {
  const { baseElement } = render(<LoginForm />)
  const form = new LoginFormHarness(dom({ user: userEvent.setup(), container: baseElement }))
  await form.signInAs('ada@example.com', 'hunter2')
  await chai.expect(form.errorBanner).to.be.absent
})
```

node:test has no `expect`, so assertions come through
[`@harnessed-ts/chai`](https://github.com/joegaudet/harnessed/blob/main/packages/chai/README.md). The register hook resolves
extensionless and NodeNext `./x.js` imports to the TypeScript file. Everything
in [Testing Library](testing-library.md) about jsdom applies.
`mock.timers` from `node:test` is not something Testing Library's waits know
about; prefer real timers in harness-driven tests.
