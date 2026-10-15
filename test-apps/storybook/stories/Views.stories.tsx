import { viewSearch } from '@harnessed-ts/conformance'
import type { View } from '@harnessed-ts/conformance'
import { App } from '@harnessed-ts/conformance/fixture'
import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * One story per conformance view. The specs open these — through portable
 * stories in Vitest, and through `StoryPage` in Playwright — so the catalog runs
 * against stories exactly as it runs against the app.
 */
const meta = {
  title: 'Conformance/Views',
  render: ({ view }) => {
    // The fixture routes on `?view=`. The iframe's own params (the story id) stay.
    const url = new URL(window.location.href)
    for (const key of ['view', 'error', 'late']) url.searchParams.delete(key)
    for (const [key, value] of new URLSearchParams(viewSearch(view))) {
      url.searchParams.set(key, value)
    }
    window.history.replaceState(null, '', url)
    return <App key={view} />
  },
} satisfies Meta<{ view: View }>
export default meta

type Story = StoryObj<typeof meta>

export const Login: Story = { args: { view: 'login' } }
export const LoginError: Story = { args: { view: 'login-error' } }
export const LoginLateDuplicates: Story = { args: { view: 'login-late-duplicates' } }
export const Cards: Story = { args: { view: 'cards' } }
export const Dialog: Story = { args: { view: 'dialog' } }
export const Frame: Story = { args: { view: 'frame' } }
export const Wizard: Story = { args: { view: 'wizard' } }
