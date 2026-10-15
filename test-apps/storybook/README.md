# test-app-storybook

The conformance catalog against stories, three ways:

- `vitest run`, project **stories**: Storybook's Vitest addon runs every story in
  `stories/` as a test. The `LoginForm` stories' play functions drive the form
  through `LoginFormHarness`, with `harnessed()` from `.storybook/preview.ts`
  supplying the harness, the steps and the matchers.
- `vitest run`, project **portable**: `specs` and `pageSpecs` with each view
  opened as a portable story (`composeStories`) and driven by the dom driver.
- `playwright test`: the same catalog with each view opened by `StoryPage`
  from `@harnessed-ts/storybook/page` against `storybook dev`, plus
  `StoryPage`'s own specs (play by default, `play: false`, args, play errors).

`urlSpecs` do not apply: they navigate the fixture app's own routes, and a
Storybook has none — a story is reached by its id, which `StoryPage` covers.

Ember is not here: `@storybook/ember` builds with webpack only, and the Vitest
addon needs a Vite build.
