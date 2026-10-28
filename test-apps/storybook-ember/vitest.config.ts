import { ember, extensions } from '@embroider/vite'
import { babel } from '@rollup/plugin-babel'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// A factory: vitest expands each project's instances in place, so they cannot be shared.
const browser = () => ({
  enabled: true,
  provider: playwright(),
  headless: true,
  instances: [{ browser: 'chromium' as const }],
})

export default defineConfig({
  test: {
    projects: [
      {
        // Every story becomes a test, and its play function the body. The
        // addon applies `viteFinal` from .storybook/main.ts, Embroider's plugins
        // included. Awaited: Embroider finds Babel in the plugin list to share it
        // with the dependency scan, and does not look inside a pending promise.
        plugins: [await storybookTest({ configDir: '.storybook' })],
        test: { name: 'stories', browser: browser(), api: { port: 5188, strictPort: true } },
      },
      {
        // The conformance catalog, each view opened as a portable story.
        plugins: [ember(), babel({ babelHelpers: 'runtime', extensions })],
        test: {
          name: 'portable',
          include: ['tests/**/*.test.ts'],
          browser: browser(),
          // A port of its own per project, so this runner can work beside the others.
          api: { port: 5189, strictPort: true },
        },
      },
    ],
  },
})
