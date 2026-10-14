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

Storybook 9 or later. See [Using with Storybook](https://github.com/joegaudet/harnessed#using-with-storybook).
