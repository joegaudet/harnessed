import { LoginFormHarness } from '@harnessed-ts/conformance'
import type { WithHarness } from '@harnessed-ts/storybook'
import type { Meta, StoryObj } from '@harnessed-ts/storybook/ember'
import { expect } from 'storybook/test'
import LoginForm from 'test-app-ember-vite/components/fixture/login-form'

interface Args {
  error?: string
}

/**
 * The Glimmer login form, rendered from the meta's `component` with each
 * story's args. Play functions drive it through its harness, each method a
 * step, and every interaction resolves once Ember has settled.
 */
const meta = {
  title: 'Forms/Login Form',
  component: LoginForm,
  parameters: { harness: LoginFormHarness },
  // Storybook applies a URL arg only when it has an argType.
  argTypes: { error: { control: 'text' } },
} satisfies Meta<Args>
export default meta

type Story = WithHarness<StoryObj<Args>, LoginFormHarness>

export const Empty: Story = {}

export const FilledIn: Story = {
  play: async ({ harness }) => {
    await harness.fillIn({ email: 'ada@example.com', password: 'hunter2' })
    await expect(harness.errorQuery).toBeAbsent()
    await expect(await harness.values()).toEqual({ email: 'ada@example.com', password: 'hunter2' })
  },
}

export const Submitted: Story = {
  play: async ({ harness }) => {
    await harness.fillIn({ email: 'ada@example.com', password: 'hunter2' })
    await harness.rememberMe()
    await harness.submitIt()
    await expect(await harness.status()).toBe('done')
  },
}

export const WithError: Story = {
  args: { error: 'Bad credentials' },
  play: async ({ harness }) => {
    await expect(harness.errorQuery).toReadAs('Bad credentials')
  },
}
