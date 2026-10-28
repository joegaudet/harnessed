import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { plugins } from './vite.shared.ts'

/** The same tests as the jsdom run, in Chromium: Vitest browser mode, Playwright provider. */
export default defineConfig({
  plugins: plugins('tsconfig.spec.json'),
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    // Browser mode serves the tests from this server. A port of its own, so this
    // runner can work beside the others.
    api: { port: 5198, strictPort: true },
  },
})
