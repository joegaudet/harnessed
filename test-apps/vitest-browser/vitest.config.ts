import { harnessedDecorators } from '@harnessed-ts/core/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Must come before the framework plugin: browsers cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), react()],
  test: {
    include: ['tests/**/*.test.tsx'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    // Browser mode serves the tests from this server. A port of its own, so this
    // runner can work beside the others.
    api: { port: 5185, strictPort: true },
  },
})
