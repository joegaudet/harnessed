---
'@harnessed-ts/ember': patch
---

`press()`, `hover()` and `selectOption()` no longer go through user-event, so no Ember driver call patches the document now. Before, any test that pressed a key, hovered or picked an option through a harness made a number input in a later test read "42.50" back as "42.5". The driver now sends the events itself:

- `press()` sends keydown and keyup to the focused element. Unless keydown is prevented, a key types into a field (respecting `maxlength`), Backspace and Delete remove text, Enter submits the field's form or adds a line to a textarea, and Tab moves focus to the next element Tab reaches.
- `hover()` sends the pointer and mouse over, enter, out and leave events, and leaves the last hovered element first.
- `selectOption()` matches an option's value or label, rejects a miss before it changes anything, and replaces a multi-select's selection.

`@testing-library/user-event` is no longer a peer dependency of `@harnessed-ts/ember`.
