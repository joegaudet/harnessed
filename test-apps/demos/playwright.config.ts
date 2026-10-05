import { defineConfig, devices } from '@playwright/test'
import { RECORDING } from './src/raw'
import { EMBER_PORT, REACT_PORT, VIEWPORT } from './src/timeline'

export default defineConfig({
  testDir: './playwright',
  forbidOnly: !!process.env.CI,
  // One browser at a time: a recording should not compete for the machine.
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: VIEWPORT,
    // Slow enough to watch each harness action land, only while recording.
    launchOptions: { slowMo: RECORDING ? 120 : 0 },
  },
  projects: [
    { name: 'react', use: { baseURL: `http://localhost:${REACT_PORT}` } },
    { name: 'ember', use: { baseURL: `http://localhost:${EMBER_PORT}` } },
  ],
  webServer: [
    {
      command: 'pnpm serve:react',
      url: `http://localhost:${REACT_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
    },
    {
      command: 'pnpm serve:ember',
      url: `http://localhost:${EMBER_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
    },
  ],
})
