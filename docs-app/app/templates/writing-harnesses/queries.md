# Queries

A query descriptor — a scope chain plus a selector — not a resolved node. Nothing
is looked up until a method is called, which is why a field can be declared before
its component has rendered.

| Group        | Members                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Interactions | `click` `fill` `clear` `check` `uncheck` `selectOption` `hover` `focus` `blur` `press` `upload`     |
| Observations | `text` `inputValue` `attribute` `isVisible` `isEnabled` `isChecked` `selectedOptions` `boundingBox` |
| Waiting      | `waitFor(state, { timeout })`                                                                       |
| Lists        | `count` `isAbsent` `nth` `first` `last` `each` `map` `filter` `texts`                               |

`upload(files)` takes a `File` or a `File[]`, on an `<input type="file">` or its
`<label>`, and replaces the selection. `boundingBox()` resolves to
`{ x, y, width, height }` in CSS pixels, relative to the top-level viewport, so a
harness can answer a layout question — a page's width at a zoom level — with
plain numbers. Both are strict single-target operations (guarantees 12 and 13).

Every method takes an optional `{ timeout }`. `waitFor('visible')` resolves once
the target is on screen and visible; `waitFor('hidden')` once it is hidden or gone —
absent counts as hidden. Both reject at once on a target that matches more than
one node (guarantee 2) or sits behind a frame that cannot be entered, since
neither changes by waiting, and otherwise when the timeout runs out. Those two are the
only states: a state joins `WaitState` only when every driver honours it with the
same meaning, so a runner's own (Playwright's `attached`, say) never leaks into a
harness.
