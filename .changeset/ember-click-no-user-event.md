---
'@harnessed-ts/ember': patch
---

`click()`, `check()` and `uncheck()` no longer go through user-event. In 0.8.0 they did, and user-event's setup patches the document for good. An Ember test run shares one document, so after any test that clicked through a harness, a number input in a later test read "42.50" back as "42.5". They now use `@ember/test-helpers`' click again and add the `pointerdown` and `pointerup` events a browser sends just before `mousedown` and `mouseup`. `press`, `hover` and `selectOption` still use user-event, so they still patch the document.
