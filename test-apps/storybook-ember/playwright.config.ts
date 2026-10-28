import { defineConfig, devices } from '@playwright/test'

const port = 6107

export default defineConfig({
  testDir: 'specs',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
  webServer: {
    cwd: new URL('.', import.meta.url).pathname,
    command: `npx storybook dev -p ${port} --ci --no-open`,
    url: `http://localhost:${port}/iframe.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
  },
})
