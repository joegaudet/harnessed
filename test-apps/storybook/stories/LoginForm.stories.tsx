import { LoginFormHarness } from '@harnessed-ts/conformance'
import { LoginForm } from '@harnessed-ts/conformance/fixture'
import type { WithHarness } from '@harnessed-ts/storybook'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

/**
 * Stories whose play functions drive the form through its harness: each method
 * is a step in the Interactions panel, and the harness matchers work on
 * Storybook's `expect`. The Vitest addon runs every one of these as a test.
 */
const meta = {
  title: 'Forms/Login Form',
  component: LoginForm,
  parameters: { harness: LoginFormHarness },
  // Storybook applies a URL arg only when it has an argType. Docgen infers them
  // for an app's own components; this one comes from a linked package, so say so.
  argTypes: { error: { control: 'text' } },
} satisfies Meta<typeof LoginForm>
export default meta

type Story = WithHarness<StoryObj<typeof meta>, LoginFormHarness>

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
