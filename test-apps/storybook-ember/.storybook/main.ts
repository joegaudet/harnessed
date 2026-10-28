import { emberIndexer } from '@harnessed-ts/storybook/ember/node'
import { ember, extensions } from '@embroider/vite'
import { babel } from '@rollup/plugin-babel'
import type { StorybookConfig } from '@storybook/html-vite'

/**
 * Storybook's HTML framework for the Vite build, with Embroider's plugins
 * added: the stories render as Ember components through `emberRenderer` in
 * preview.ts, and `.gts` stories are indexed by `emberIndexer`.
 */
const config: StorybookConfig = {
  framework: '@storybook/html-vite',
  stories: ['../stories/*.stories.@(ts|gts)'],
  addons: ['@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  experimental_indexers: existing => [emberIndexer, ...(existing ?? [])],
  viteFinal: config => ({
    ...config,
    plugins: [...(config.plugins ?? []), ember(), babel({ babelHelpers: 'runtime', extensions })],
  }),
}
export default config
