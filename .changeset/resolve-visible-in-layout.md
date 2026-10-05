---
'@harnessed-ts/resolve': minor
---

Add `isVisibleInLayout(element, home?)`, Playwright's visibility rule — a non-empty box that `visibility` does not hide, inside frames that are visible too — for in-page drivers running in a real browser. The injected page API answers it too, as `visible(element)`, for drivers that resolve from outside the page. The main entry no longer imports Node's `url` and `path` through a chunk shared with `/inject`, so it loads in a browser.
