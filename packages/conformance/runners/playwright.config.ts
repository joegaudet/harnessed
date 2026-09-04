import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: new URL('../specs', import.meta.url).pathname,
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5177' },
  webServer: {
    // Playwright runs this from the config file's directory, not the package root.
    cwd: new URL('..', import.meta.url).pathname,
    command: 'npx vite --config runners/vite.config.ts',
    url: 'http://localhost:5177',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
  },
})
