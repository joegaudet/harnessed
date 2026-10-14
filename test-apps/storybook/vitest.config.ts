import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
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
        // Every story becomes a test, and its play function the body: the
        // harness-driven plays in stories/ run here exactly as in Storybook.
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: { name: 'stories', browser: browser(), api: { port: 5186, strictPort: true } },
      },
      {
        // The conformance catalog, each view opened as a portable story.
        // Must come before the framework plugin: browsers cannot parse `accessor` fields.
        plugins: [harnessedDecorators(), react()],
        test: {
          name: 'portable',
          include: ['tests/**/*.test.ts'],
          browser: browser(),
          // A port of its own per project, so this runner can work beside the others.
          api: { port: 5187, strictPort: true },
        },
      },
    ],
  },
})
