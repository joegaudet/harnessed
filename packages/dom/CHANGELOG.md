# @harnessed-ts/dom

## 0.1.0

First release.

Testing Library driver. Queries the DOM rather than React, so it carries no React
dependency and works with any Testing Library setup. Takes an optional `container`
to scope a harness to one tree, and resolves whole lists in a single pass so
`each`/`map`/`filter` cost one scope walk instead of one per element.
