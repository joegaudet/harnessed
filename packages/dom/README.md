# @harnessed/dom

Testing Library driver for `@harnessed/core`. Framework-agnostic — it queries the
DOM, so it has no React dependency and works with any Testing Library setup.

```ts
import { dom } from "@harnessed/dom"
import "@harnessed/dom/matchers"

render(<LoginForm />)
const form = new LoginFormHarness(dom({ user: userEvent.setup() }))
```

Pass `container` to scope a harness to one tree — which is what makes two
instances in a single test, and portals, work without a cleanup race.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
