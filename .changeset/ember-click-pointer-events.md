---
'@harnessed-ts/ember': patch
---

`click()`, `check()` and `uncheck()` under the Ember driver now send the pointer events a browser sends (`pointerdown` and `pointerup` around `mousedown`, `mouseup` and `click`), as the dom driver does. They went through `@ember/test-helpers`' `click`, which sends no pointer events, so a handler on `pointerup` never ran.
