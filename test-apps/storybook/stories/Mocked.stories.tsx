import { DataScreenHarness, UsersApi } from '@harnessed-ts/conformance'
import { DataScreen } from '@harnessed-ts/conformance/fixture'
import type { WithHarness } from '@harnessed-ts/storybook'
import { http, json, problem } from '@harnessed-ts/storybook/mock'
import type { HarnessedParameters, MockedContext } from '@harnessed-ts/storybook/mock'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

/**
 * Stories that declare their backend in `parameters.harnessed.mocks`: installed
 * before the story renders, in the Storybook UI as under test, and ended
 * before the next story. The Vitest addon runs each play function as a test.
 */
const meta = {
  title: 'Mocking/Data Screen',
  component: DataScreen,
  parameters: { harness: DataScreenHarness },
} satisfies Meta<typeof DataScreen>
export default meta

type Story = WithHarness<StoryObj<typeof meta>, DataScreenHarness>

/** An API harness answers the request the screen makes as it mounts. */
export const Loaded: Story = {
  parameters: { harnessed: { mocks: [UsersApi] } satisfies HarnessedParameters },
  play: async ({ harness }) => {
    await expect(await harness.userName()).toBe('Ada Lovelace')
  },
}

/** A handler table, and options: the failure state, as a story. */
export const Forbidden: Story = {
  parameters: {
    harnessed: {
      scope: '/api/**',
      mocks: [http.get('/api/users/:id', () => problem({ status: 403, title: 'Not allowed' }))],
    } satisfies HarnessedParameters,
  },
  play: async ({ harness }) => {
    await expect(await harness.userError()).toBe('Not allowed')
  },
}

/** `play` gets the story's mock, to change a route and assert on requests. */
export const Reloaded: Story = {
  parameters: { harnessed: { mocks: [UsersApi] } satisfies HarnessedParameters },
  play: async context => {
    const { harness, mocks } = context as typeof context & MockedContext
    await expect(await harness.userName()).toBe('Ada Lovelace')
    await mocks!.get('/api/users/:id').reply(json({ name: 'Grace Hopper' }))
    await harness.reloadUser()
    await harness.waitForUserName('Grace Hopper')
    await expect(mocks!.calls('/api/users/:id')).toHaveLength(2)
  },
}
