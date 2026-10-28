// The /mock entry's harnessed() also installs `parameters.harnessed.mocks`.
import { harnessed } from '@harnessed-ts/storybook/mock'
import type { Preview } from '@storybook/react-vite'

export default { ...harnessed() } satisfies Preview
