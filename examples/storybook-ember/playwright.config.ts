import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:6006' },
  webServer: {
    command: 'npx storybook dev -p 6006 --ci --no-open',
    url: 'http://localhost:6006/iframe.html',
    reuseExistingServer: true,
  },
})
