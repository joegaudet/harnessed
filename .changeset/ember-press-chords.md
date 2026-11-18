---
'@harnessed-ts/ember': patch
---

`press` takes a Playwright chord again, such as `Shift+ArrowDown` or `ControlOrMeta+a`. The modifiers go down before the key and up after it, and each event sent while a modifier is down has its flag (`shiftKey`, `ctrlKey`, `altKey`, `metaKey`). A chord with Control, Meta or Alt types nothing. `Shift+Tab` moves focus to the previous field.
