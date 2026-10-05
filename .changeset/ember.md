---
'@harnessed-ts/ember': minor
'@harnessed-ts/conformance': minor
---

New `@harnessed-ts/ember` driver: queries resolve through `@harnessed-ts/resolve`, interactions go through `@ember/test-helpers` and settle after each one, and a page's `goto()` drives the router in application tests. It passes the whole conformance catalog under ember-qunit, on classic and Embroider + Vite builds, Ember 5.12 to latest.

`@harnessed-ts/conformance` exports `fixtureTree()` and `fixtureTrees` so a port of the fixture to another framework can prove it renders the same markup as the React original.
