import { emberRenderer, harnessed } from '@harnessed-ts/storybook/ember'
import type { Preview } from '@harnessed-ts/storybook/ember'

// Renders each story as an Ember component, puts the story's harness in every
// play function with its methods logged as steps, settles Ember after every
// interaction, and adds the harness matchers to storybook/test's expect.
export default { ...emberRenderer, ...harnessed() } satisfies Preview
