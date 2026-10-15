import { harnessed } from '@harnessed-ts/storybook'
import type { Preview } from '@storybook/react-vite'

// Puts the story's harness in every play function, logs its methods as steps,
// and adds the harness matchers to storybook/test's expect.
export default { ...harnessed() } satisfies Preview
