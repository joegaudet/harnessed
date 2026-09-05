# @harnessed-ts/conformance

## 0.1.0

First release.

The cross-driver certification suite: one set of behavioural specs every driver
runs, published so a driver written outside this repo can prove it agrees with the
others. Exports `specs`, `routeSpecs`, and the fixture app; needs only
`@harnessed-ts/core` and `@harnessed-ts/route`, not any particular driver.
