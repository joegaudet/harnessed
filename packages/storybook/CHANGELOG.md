# @harnessed-ts/storybook

## 0.5.0

### Minor Changes

- ad20e8c: Add `@harnessed-ts/storybook`. Spread `harnessed()` into `.storybook/preview.ts`, and a story that names its harness in `parameters.harness` gets it in `play` as `context.harness`. The harness drives the canvas through Storybook's instrumented `userEvent`, each public method is a step in the Interactions panel (secret-looking arguments are masked by parameter name in development, and by object key in a minified build too), and the harness matchers are registered on `storybook/test`'s `expect`. `StoryPage` from `@harnessed-ts/storybook/page` opens a story by URL from any runner that can navigate, with typed `args` and `globals`, `play: false` to skip the play function, and a play function's own error when it throws. React only: `@storybook/ember` builds with webpack, and Storybook's Vitest addon needs Vite.

  `no-raw-locator-in-test` now treats `*.stories.*` files as tests, flagging `canvas.getBy*`, `within` from `storybook/test`, and `canvasElement.querySelector`. `npx @harnessed-ts/claude install` detects Storybook and documents the preview setup, `play` with a harness, and `StoryPage`.

### Patch Changes

- @harnessed-ts/core@0.5.0
  - @harnessed-ts/dom@0.5.0
  - @harnessed-ts/page@0.5.0
