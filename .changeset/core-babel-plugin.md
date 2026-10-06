---
'@harnessed-ts/core': minor
---

Add `@harnessed-ts/core/babel`, a Babel plugin for apps whose own decorators are legacy — Ember's `@tracked`, `@service`, `@action`. It claims harness files only (`*.harness.*`, `*.page.*`, `harness/`, `harnesses/`, or your own `include`), lowers their standard decorators and `accessor` fields before the app's plugins run, and leaves every other file to the app's pipeline. Tested through both ember-cli-babel's legacy proposal plugin and Embroider's decorator-transforms.
