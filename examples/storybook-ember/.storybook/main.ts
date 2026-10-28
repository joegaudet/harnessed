import { emberIndexer } from '@harnessed-ts/storybook/ember/node'
import { ember, extensions } from '@embroider/vite'
import { babel } from '@rollup/plugin-babel'
import type { StorybookConfig } from '@storybook/html-vite'

const config: StorybookConfig = {
  // The HTML framework for the Vite build; preview.ts renders stories as Ember components.
  framework: '@storybook/html-vite',
  stories: ['../src/**/*.stories.gts'],
  addons: ['@storybook/addon-vitest'],
  // Storybook's own indexer cannot parse <template> tags.
  experimental_indexers: existing => [emberIndexer, ...(existing ?? [])],
  viteFinal: config => ({
    ...config,
    plugins: [...(config.plugins ?? []), ember(), babel({ babelHelpers: 'runtime', extensions })],
  }),
}
export default config
