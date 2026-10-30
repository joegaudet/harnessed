# Component harnesses

`@Harness({ host })` declares the root element. Element fields are
`private accessor` and use `@ByRole` / `@ByTestId` / `@ByLabel` / `@ByText` /
`@ByPlaceholder`, scoped to the host. `@ChildHarness(Cls)` nests a harness and
passes the scope chain down; `@ChildHarness(Cls, { frame: testId('…') })` nests it
inside an iframe.

- `self` — the host element. Right when the host _is_ the control.
- `count` / `isAbsent` / `nth` / `first` / `last` / `each` / `map` / `filter` — for a
  component rendered several times on one screen.
- `elementBy(selector)` — a selector computed at call time, still scoped.
- `childHarness(Cls, { frame })` — the method form of `@ChildHarness`.

An **abstract** base may carry fields and methods with no host of its own; each
subclass supplies one. Resolution walks the prototype chain and the nearest
`@Harness` wins, so a subclass can also override a base's host.
