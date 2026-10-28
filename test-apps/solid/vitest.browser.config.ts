import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { playwright } from '@vitest/browser-playwright'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

/**
 * The catalog under the vitest-browser driver. Mounted through
 * @solidjs/testing-library, which renders into the real page's DOM:
 * vitest-browser-solid's latest release still asks for Vitest 4.
 */
export default defineConfig({
  // Must come before the framework plugin: browsers cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), solid()],
  test: {
    include: ['tests/browser/*.test.tsx'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    // Browser mode serves the tests from this server. A port of its own, so this
    // runner can work beside the others.
    api: { port: 5292, strictPort: true },
  },
})
