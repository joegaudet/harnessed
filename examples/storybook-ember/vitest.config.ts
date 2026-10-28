import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Every story is a test, and its play function the body. Awaited, so that
// Embroider (added in .storybook/main.ts) can find Babel among the plugins.
export default defineConfig({
  plugins: [await storybookTest({ configDir: '.storybook' })],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
