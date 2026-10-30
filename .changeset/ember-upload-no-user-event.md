---
'@harnessed-ts/ember': patch
---

`upload()` no longer goes through user-event. user-event's setup patches the document for good, and an Ember test run shares one document, so after a test that uploaded a file, a number input in a later test read "42.50" back as "42.5". The driver now sets the files itself and fires `input` and `change`, keeping user-event's rules: a disabled input is skipped, files `accept` refuses are dropped, and an unchanged selection fires nothing. `press`, `hover` and `selectOption` still use user-event, so they still patch the document.
