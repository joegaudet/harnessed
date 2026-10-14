// Storybook: a harness in every play function, and stories opened as fixtures.
// Once, in .storybook/preview.ts:
//   import { harnessed } from '@harnessed-ts/storybook'
//   export default { ...harnessed() } satisfies Preview
// A story names its harness in `parameters`; play receives it as `harness`,
// with each method a step in the Interactions panel. Never query the canvas.
import type { WithHarness } from '@harnessed-ts/storybook'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Checkout } from '../src/pages/Checkout'
import { CheckoutHarness } from '../harness/checkout.harness'

const meta = {
  title: 'Pages/Checkout',
  component: Checkout,
  parameters: { harness: CheckoutHarness },
} satisfies Meta<typeof Checkout>
export default meta

type Story = WithHarness<StoryObj<typeof meta>, CheckoutHarness>

export const Paid: Story = {
  play: async ({ harness }) => {
    await harness.pay()
    await expect(harness.confirmation).toReadAs('Thanks!')
  },
}

// From Playwright (or any runner that can navigate), the same story as a fixture.
// play: false opens it before its play function runs:
//   import { StoryPage } from '@harnessed-ts/storybook/page'
//   import * as CheckoutStories from './Checkout.stories'
//   const story = await StoryPage.goto(pw(page), CheckoutStories, 'Paid', { play: false })
//   await story.harness(CheckoutHarness).pay()
