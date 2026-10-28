# @harnessed-ts/storybook

Harnesses in Storybook. A harness in every play function, with each of its
methods a step in the Interactions panel, and stories opened as fixtures from
any runner that can navigate.

```ts
// .storybook/preview.ts
import { harnessed } from '@harnessed-ts/storybook'
export default { ...harnessed() } satisfies Preview
```

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

```ts
// Playwright, or any runner whose driver can navigate
import { StoryPage } from '@harnessed-ts/storybook/page'
import * as LoginStories from './LoginForm.stories'

const story = await StoryPage.goto(pw(page), LoginStories, 'WrongPassword', { play: false })
await story.harness(LoginFormHarness).signInAs('ada@example.com', 'hunter2')
```

**Ember.** `@harnessed-ts/storybook/ember` renders stories as Ember components
under `@storybook/html-vite`, through Ember's `renderComponent`, and its
`harnessed()` settles Ember after every interaction. `emberIndexer` from
`/ember/node` indexes `.gts` stories.

```ts
// .storybook/preview.ts
import { emberRenderer, harnessed } from '@harnessed-ts/storybook/ember'
export default { ...emberRenderer, ...harnessed() } satisfies Preview
```

Storybook 9 or later; 10 or later, with Ember 6.8 or later, for Ember. See
[Using with Storybook](https://github.com/joegaudet/harnessed#using-with-storybook)
and [Ember stories](https://github.com/joegaudet/harnessed#ember-stories).
