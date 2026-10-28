import { harnessedDecorators } from '@harnessed-ts/core/vite'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/** The catalog under the vitest-browser driver, mounted through vitest-browser-vue. */
export default defineConfig({
  // Must come before the framework plugin: browsers cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), vue()],
  test: {
    include: ['tests/browser/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    // Browser mode serves the tests from this server. A port of its own, so this
    // runner can work beside the others.
    api: { port: 5291, strictPort: true },
  },
})
