# Cross-driver guarantees

Every item below is backed by a spec in `packages/conformance` that runs, unchanged,
under each driver. A driver that disagrees with another fails the build — that
agreement is the whole reason the abstraction exists.

1. **Absence answers immediately.** `count()` and `isAbsent()` on something that is
   not on screen return straight away. They never wait out a timeout and never
   throw.
2. **Single-target operations are strict.** More than one match is a
   `StrictModeViolation` naming the selector, raised at once — never a silent pick
   of the first. That holds for questions and waits too: `isVisible()`,
   `waitFor('visible')` and `waitFor('hidden')` on duplicates reject with the same
   violation rather than answering `false` or waiting out the timeout. It is core's
   class, in the same wording, under every driver — those that resolve inside a
   remote page included — so `instanceof StrictModeViolation` tells ambiguity
   apart from absence. An `nth()` past the last match is not ambiguous: there
   `isVisible()` answers `false` and `waitFor('hidden')` resolves, as for an absent
   target.
3. **`role` selectors honour `level`.** `@ByRole('heading', { level: 1 })` picks the
   `h1` on a screen that also has an `h2`.
4. **`elementBy()` keeps the harness's scope.** A selector computed at call time is
   still scoped to the host, so a matching node elsewhere on the page is not found.
5. **`{ global: true }` escapes the scope, and only it does.** A portalled dialog is
   reachable from a global field and invisible to a scoped one.
6. **A page composes under its own scope.** A component harness or a page nested
   in a page with `@ChildHarness` inherits the page's scope chain, so a matching
   node elsewhere on the screen is not found.
7. **Readiness is one check, phrased one way.** `expectReady()` resolves once the
   page's `waitForReady()` does, and otherwise rejects naming the page —
   `<Page> did not become ready.` with the original failure as `cause`, or
   `<Page> did not become ready within <n>ms.` when an explicit `{ timeout }`
   elapsed first. `isReady()` answers `false` and never throws.
8. **Transitions hand back a ready page.** `transitionTo(NextPage)` constructs the
   next page in the same scope and awaits its readiness before returning it.
9. **A page constructs under every driver.** Only `goto()` and the URL members
   need a driver that can navigate; under one that cannot they fail at call time
   with `the "<driver>" driver cannot navigate`. `goto()` on a page with no `path`
   fails with `<Page> declares no path` before touching the driver. `urlFor()`
   resolves the URL `goto()` would visit under any driver, navigating or not.
10. **A frame is a scope boundary, crossed only by `frame()`.** A harness nested
    through a frame reads and drives the frame's document; a scoped query outside
    it never sees in; `{ global: true }` inside it stays in the frame's document;
    a frame marker on anything but an `<iframe>` rejects; and a page nested in a
    frame refuses its URL members with `<Page> is nested in a frame`. The dom
    driver enters same-origin frames only, and names the frame when it cannot.
11. **A `data-test-*` test id matches by presence, under the same rules.** With
    `testIdAttribute: 'data-test-*'`, `testId('x')` finds every element that has
    `data-test-x`, whatever its value, and never one that only has
    `data-testid="x"`. Scope, strictness, `{ global: true }`, frames and
    immediate absence hold exactly as above. An id with anything but letters,
    digits, `-`, `_`, `.` and `:` (or a `RegExp`) is refused with an error under
    every driver, never spliced into a selector.
12. **`boundingBox()` measures against the top-level viewport.** The border box
    in CSS pixels, offset by every frame crossed — inside each iframe's border
    and padding. A node that draws no box reads as all zeros. Strict, and on an
    absent target it waits out the timeout and rejects, as `text()` does.
13. **`upload()` sets a file input's files and fires `change`.** On the input or
    its `<label>`, replacing any earlier selection; the page sees each file's
    name and bytes. Anything but a file input, or several files for an input
    that is not `multiple`, is refused at once, in one wording.

Where the drivers genuinely cannot match, the difference is documented rather than
papered over:

- **`isVisible()`** is a layout check — a non-empty box that `visibility` does not
  hide, inside frames that are visible too — under every driver except the dom
  driver. jsdom computes no layout, so there it is a computed-style check, and a
  node with no box reads as visible. Assert on absence or on state, not on
  visibility, when you want the same answer from jsdom and a browser.
- **`boundingBox()`** under the dom driver is jsdom's `getBoundingClientRect()`:
  jsdom computes no layout, so every box is all zeros. Assert sizes under a
  browser driver. Under ember-qunit the app renders inside `#ember-testing`,
  which ember-qunit draws at half size inside a transformed container: boxes
  there are what is drawn, so turn that off (`transform: none` on
  `#ember-testing-container`, and `transform: none; width: 100%; height: 100%`
  on `#ember-testing`) in a suite that asserts sizes.
- **`upload()`** hands each `File` over as it is under the dom driver, Ember,
  Cypress (real events or not), Vitest browser mode and Playwright. Puppeteer,
  WebdriverIO and TestCafe take only paths, so each file is first written to a
  temporary directory: its name and bytes arrive, but the browser infers `type`
  from the extension, `lastModified` is the time of writing, and the browser
  must share the test's file system (a remote WebDriver grid does not).
  user-event, behind the in-page drivers, drops files an `accept` attribute
  rules out; the browser drivers set them anyway. Do not rely on `accept`
  filtering in a test.
- **Frames** are same-origin only under the dom driver, Ember, Cypress, TestCafe
  and Vitest browser mode, which resolve inside the page and cannot read a
  cross-origin document. Playwright, Puppeteer and WebdriverIO enter frames from
  outside the page, so cross-origin frames work there.
- **`currentUrl`** is synchronous, so under WebdriverIO and TestCafe, which read the
  page asynchronously, it is the URL as of the driver's last call. After an
  in-app navigation, `await page.assertPathname(...)`, which polls, before reading
  it.
- **Navigation** needs an address bar: under the dom driver, Vitest browser mode,
  Cypress component tests and Ember rendering tests a page constructs and reads,
  but `goto()` and the URL members are refused.
- **`check()` / `uncheck()`** need a real checkbox or radio under Playwright. For a
  non-native control, read `aria-checked` — which every driver prefers when present.
