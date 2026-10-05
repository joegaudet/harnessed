# @harnessed-ts/ember

Ember driver for `@harnessed-ts/core`. Queries resolve through the shared
resolver, so they agree with every other driver; interactions go through
`@ember/test-helpers`, so each one resolves once the app has settled.

```ts
import { ember } from '@harnessed-ts/ember'

// a rendering test
await render(<template><LoginForm /></template>)
const form = new LoginFormHarness(ember())
await form.signInAs('ada@example.com', 'hunter2')

// an application test: a page's goto() drives the router
const checkout = new CheckoutPage(ember())
await checkout.goto({ token })
```

Works under ember-qunit, on classic and Embroider + Vite builds, Ember 5.12 and
later.
Harness files need `@harnessed-ts/core/babel` in the app's Babel config — Ember's
own decorators are legacy, harnesses are standard.

Full guide: the
[harnessed README](https://github.com/joegaudet/harnessed#using-with-ember).

MIT © Joe Gaudet, Jay Seo
