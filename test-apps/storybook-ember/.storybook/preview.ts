import { emberRenderer, harnessed } from '@harnessed-ts/storybook/ember'
import type { Preview } from '@harnessed-ts/storybook/ember'

export default { ...emberRenderer, ...harnessed() } satisfies Preview
