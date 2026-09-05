# @harnessed/conformance

The cross-driver certification suite for [harnessed](https://github.com/joegaudet/harnessed).

A driver for `@harnessed/core` is not finished when it compiles. It is finished
when it agrees with every other driver about what the shared API means — that
agreement is the library's entire promise, and this is what decides it.

One set of behavioural specs, executed by every driver. If yours passes, a harness
written against another driver works against yours unchanged.

```ts
import { specs, routeSpecs } from '@harnessed/conformance'
import { App } from '@harnessed/conformance/fixture'

for (const spec of specs) {
  it(spec.name, () => spec.run({ show: view => mountFixtureAndBuildEnv(view) }))
}
```

`show(view)` puts the named view of the fixture app on screen and returns the
`EnvConfig` a harness is constructed with. Everything else is the suite's job.

- **`specs`** — the shared behavioural suite. Every driver runs all of them.
- **`routeSpecs`** — navigation, for drivers that register a `Navigation`
  capability. Skip them if yours cannot drive a URL; component harnesses still work.
- **`@harnessed/conformance/fixture`** — the React app the specs drive. Serve it or
  render it. React is an optional peer: port the fixture instead if you would rather
  not take it.

The two reference runners live in this package's source under `runners/` — Vitest
with jsdom, and Playwright against Vite. They are the shortest honest description
of what wiring a driver in looks like.

The guarantees these specs enforce are listed in the
[root README](https://github.com/joegaudet/harnessed#cross-driver-guarantees).

MIT © Joe Gaudet, Jay Seo
