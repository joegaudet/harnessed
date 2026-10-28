# test-app-storybook-ember

The conformance catalog against Ember stories, the same three ways as
`test-apps/storybook` runs it against React:

- `vitest run`, project **stories**: Storybook's Vitest addon runs every story in
  `stories/` as a test. The `LoginForm` stories' play functions drive the
  Glimmer form through `LoginFormHarness`, with `harnessed()` from
  `@harnessed-ts/storybook/ember` supplying the harness, the steps, the matchers,
  and a settle after every interaction.
- `vitest run`, project **portable**: `specs` and `pageSpecs` with each view
  opened as a portable story (`composeStories` from
  `@harnessed-ts/storybook/ember`) and driven by the dom driver.
- `playwright test`: the same catalog with each view opened by `StoryPage`
  against `storybook dev`, plus `StoryPage`'s own specs. The stories import
  Ember components, which Playwright's Node process cannot load, so the specs
  name each module by title through `storiesModule()`.

The build is a minimal Embroider app — `@embroider/vite`'s `ember()` and Babel,
no ember-cli and no classic compat — under `@storybook/html-vite`, with
`emberRenderer` in `.storybook/preview.ts` rendering each story through
Ember's `renderComponent` (Ember 6.8 or later). `Views.stories.gts` renders with
a `<template>`, indexed by `emberIndexer`; `LoginForm.stories.ts` names a
`component`.

The fixture is the Glimmer port in `test-apps/ember-vite`, imported through
that app's `exports`, so there is one Ember fixture to keep in step with the
React original.

`urlSpecs` do not apply: they navigate the fixture app's own routes, and a
Storybook has none. The catalog runs on `data-testid`: the Ember fixture
carries `data-test-*` attributes only on the nodes the presence-id specs need,
so a `data-test-*` config could not find the rest.
