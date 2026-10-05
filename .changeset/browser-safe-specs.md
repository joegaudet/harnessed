---
'@harnessed-ts/conformance': patch
---

The exported specs no longer import `node:assert`, so a driver whose runner executes in a browser (Testem, Cypress, Vitest browser mode) can run the catalog unchanged.
