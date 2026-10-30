# Adding a driver

`@harnessed-ts/core` holds a registry keyed by driver id and never imports a driver.
A driver supplies an env, 21 `Query` members, and a registration:

```ts
registerDriver('my-driver', (env, scope, selector) => new MyQuery(env, scope, selector))
```

Everything list-shaped — `nth`, `first`, `last`, `each`, `map`, `filter`, `texts`,
`isAbsent` — is inherited. Override `all()` if resolving a whole list at once is
cheaper for you than resolving each element (it is, for Testing Library; it is not
for Playwright, whose locators are descriptors). The registry lives on `globalThis`
under a `Symbol.for` key, so a graph that loads both the ESM and the CJS build
still has one registry.

Resolving selectors is the part most likely to drift. If your driver can run
JavaScript in the page, use [`@harnessed-ts/resolve`](https://github.com/joegaudet/harnessed/blob/main/packages/resolve/README.md)
rather than writing your own: it is what the Testing Library driver uses, so role,
label, strictness and frame semantics come out identical. A driver that resolves
from Node injects its self-contained build (`@harnessed-ts/resolve/inject`), and
passes what the page throws through core's `reviveStrictViolation()`: a class
does not survive the trip back, and that restores `StrictModeViolation`.

If your driver can navigate, register that too and a page's `goto()` works
against it unchanged:

```ts
registerNavigation('my-driver', { goto, currentUrl, waitForUrl })
```

**A driver is done when it passes the conformance suite**, which is published for
exactly this purpose:

```bash
npm i -D @harnessed-ts/conformance
```

See [`@harnessed-ts/conformance`](https://github.com/joegaudet/harnessed/blob/main/packages/conformance/README.md) — one set of specs,
run by every driver, so a harness written against one works against yours.
