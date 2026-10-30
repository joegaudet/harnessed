# See it run

One demo flow, [`test-apps/demos/src/demo.ts`](https://github.com/joegaudet/harnessed/blob/main/test-apps/demos/src/demo.ts),
written once against the conformance fixture's harnesses and pages, run under
five environments. Every recording drives the same harness classes with the same
`demo()` function, shown beside the footage with the running step lit.

**React Testing Library · React** — `@harnessed-ts/dom` under Vitest. jsdom has
no screen, so this one is a replay of the DOM jsdom rendered, snapshotted as it
changed and redrawn in a browser.

![The demo under React Testing Library in jsdom: a replay of the rendered DOM beside demo.ts](https://raw.githubusercontent.com/joegaudet/harnessed/main/docs/media/rtl.gif)

**Playwright · React** — `@harnessed-ts/playwright`, recorded with Playwright's
`recordVideo`.

![The demo under Playwright against the React fixture, beside demo.ts](https://raw.githubusercontent.com/joegaudet/harnessed/main/docs/media/playwright-react.gif)

**Playwright · Ember** — the same run against the Glimmer copy of the fixture.

![The demo under Playwright against the Ember app, beside demo.ts](https://raw.githubusercontent.com/joegaudet/harnessed/main/docs/media/playwright-ember.gif)

**Cypress · React** — `@harnessed-ts/cypress` inside `cy.harnessEnv`, from
Cypress's own video. The command log lists each harness action.

![The demo under Cypress against the React fixture, beside demo.ts](https://raw.githubusercontent.com/joegaudet/harnessed/main/docs/media/cypress-react.gif)

**Cypress · Ember** — the same run against the Glimmer copy of the fixture.

![The demo under Cypress against the Ember app, beside demo.ts](https://raw.githubusercontent.com/joegaudet/harnessed/main/docs/media/cypress-ember.gif)

To regenerate the GIFs, run `pnpm --filter test-app-demos record`. It needs:

- `ffmpeg` and `ffprobe` on `PATH`;
- Playwright's Chromium: `pnpm --filter test-app-demos exec playwright install chromium`;
- the Cypress binary: `pnpm --filter test-app-demos exec cypress install`;
- the packages built: `pnpm build` at the repo root.

CI runs the same demo under all five environments, without recording, so the
demo keeps passing against the harnesses it shows. `record` also writes the hash
of the `demo.ts` it recorded to `docs/media/demo.sha256`, and CI fails when
`demo.ts` no longer matches it, so the code beside the footage is the code in
the repo. A change to a harness or the fixture that leaves `demo.ts` alone still
passes; re-record then if it changes what the footage shows.
