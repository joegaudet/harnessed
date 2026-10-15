import { harnessedDecorators } from '@harnessed-ts/core/vite'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/*.stories.tsx'],
  addons: ['@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  // Must come before the framework's React plugin: browsers cannot parse `accessor` fields.
  viteFinal: config => ({ ...config, plugins: [harnessedDecorators(), ...(config.plugins ?? [])] }),
}
export default config
