# Storybook

```bash
npm i -D @harnessed-ts/core @harnessed-ts/storybook @testing-library/dom @testing-library/user-event
```

Storybook 9 or later. One line in the preview puts a harness in every play
function:

```ts
// .storybook/preview.ts
import { harnessed } from '@harnessed-ts/storybook'
export default { ...harnessed() } satisfies Preview
```

A story names its harness in `parameters`, and `play` receives it. The harness
drives the canvas through Storybook's own `userEvent`, so the Interactions panel
shows each harness method as a step, `LoginFormHarness.signInAs("ada@example.com", "•••")`,
with its clicks and keystrokes nested under it. Arguments whose parameter name
looks like a secret (`password`, `token`, `apiKey`, `pin`, `otp`, `auth`…) are
masked; a minified `storybook build` renames parameters and classes, so there
only secret-looking object keys are masked. Step labels are visible to anyone
who can open a published Storybook, so keep real credentials out of stories.
The harness matchers work on `storybook/test`'s `expect`.

```tsx
const meta = {
  title: 'Forms/Login Form',
  component: LoginForm,
  parameters: { harness: LoginFormHarness },
} satisfies Meta<typeof LoginForm>
export default meta

type Story = WithHarness<StoryObj<typeof meta>, LoginFormHarness>

export const WrongPassword: Story = {
  play: async ({ harness }) => {
    await harness.signInAs('ada@example.com', 'guess')
    await expect(await harness.error()).toBe('Wrong password')
  },
}
```

Storybook's Vitest addon runs those play functions as tests, and portable
stories (`composeStories`) run them anywhere else, with no extra setup.

**Stories as fixtures.** `StoryPage` (`@harnessed-ts/storybook/page`) opens a
story by URL from any runner that can navigate (Playwright, WebdriverIO,
Puppeteer and the rest), so a browser suite reuses the stories instead of
building its own test pages:

```ts
import { StoryPage } from '@harnessed-ts/storybook/page'
import * as LoginStories from './LoginForm.stories'

const story = await StoryPage.goto(pw(page), LoginStories, 'WrongPassword', { play: false })
const form = story.harness(LoginFormHarness)
```

- The story id comes from the imported module: the meta's `title` (or `id`) and
  the export name, as Storybook derives it. A meta with neither is refused.
- **`play`** runs by default, as it does in Storybook, and `goto` waits until it
  has finished. `play: false` opens the story before it plays. A play function
  that throws fails `goto` with its own error.
- **`args` and `globals`** are typed from the story and encoded in Storybook's
  URL syntax. Storybook only applies an arg that has an argType, and only plain
  values (letters, digits, spaces, `_`, `-`, numbers, booleans). Anything else is
  refused here rather than silently dropped there.

The ESLint plugin treats `*.stories.*` files (Ember's `.gjs` and `.gts` too) as
tests: `canvas.getBy*`, `within` from `storybook/test`, and
`canvasElement.querySelector` are flagged in favour of the harness.

## Ember stories

```bash
npm i -D @harnessed-ts/core @harnessed-ts/storybook @storybook/html-vite content-tag @testing-library/dom @testing-library/user-event
```

`@harnessed-ts/storybook/ember` renders stories as Ember components, so an
Embroider app gets Storybook's Vite build, its Vitest addon and portable stories.
`@storybook/ember` builds only with webpack; this uses `@storybook/html-vite`
for the build and Ember's own `renderComponent` for the canvas, which needs
Ember 6.8 or later and Storybook 10.

```ts
// .storybook/main.ts
import { emberIndexer } from '@harnessed-ts/storybook/ember/node'
import { ember, extensions } from '@embroider/vite'
import { babel } from '@rollup/plugin-babel'
import type { StorybookConfig } from '@storybook/html-vite'

export default {
  framework: '@storybook/html-vite',
  stories: ['../app/**/*.stories.@(ts|gts)'],
  // Storybook's own indexer cannot parse <template> tags.
  experimental_indexers: existing => [emberIndexer, ...(existing ?? [])],
  viteFinal: config => ({
    ...config,
    plugins: [...(config.plugins ?? []), ember(), babel({ babelHelpers: 'runtime', extensions })],
  }),
} satisfies StorybookConfig
```

```ts
// .storybook/preview.ts
import { emberRenderer, harnessed } from '@harnessed-ts/storybook/ember'
export default { ...emberRenderer, ...harnessed() } satisfies Preview
```

`harnessed()` from `/ember` is the same preview, with one addition: every
interaction a harness makes resolves once Ember has settled (rendering done, no
run loop, timer or `@ember/test-waiters` waiter pending), as it does under
`@harnessed-ts/ember`. A story renders its meta's `component` with the story's
args, or whatever its `render` returns, `<template>` included:

```gts
const meta = {
  title: 'Forms/Login Form',
  render: () => <template><LoginForm @onSubmit={{checkPassword}} /></template>,
  parameters: { harness: LoginFormHarness },
} satisfies Meta
```

- **Services.** `parameters.ember.owner` sets the owner a story renders with,
  or a function that returns one. Without it, components get Ember's default,
  enough for any that look nothing up.
- **Args** remount the component when they change in the Controls panel.
- **Portable stories.** `composeStories` and `setProjectAnnotations` come from
  `@harnessed-ts/storybook/ember`, with the renderer built in.
- **`StoryPage`.** A Node runner cannot import a stories module that imports
  Ember. `storiesModule<typeof LoginStories>({ title: 'Forms/Login Form' })` from
  `@harnessed-ts/storybook/page` stands in for it, typed as the module.
- **Vitest addon.** Await `storybookTest()` in `vitest.config.ts`. Embroider
  looks for Babel in the plugin list to share it with Vite's dependency scan,
  and does not look inside a pending promise.

[`examples/storybook-ember`](https://github.com/joegaudet/harnessed/blob/main/examples/storybook-ember) is a complete setup.

**Mocking:** `harnessed()` from `@harnessed-ts/storybook/mock` in the preview, and `parameters: { harnessed: { mocks: [UsersApi] } }` on a story — see [Mocking APIs](../mocking/mocking-apis.md).
