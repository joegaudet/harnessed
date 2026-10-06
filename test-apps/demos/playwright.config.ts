import { defineConfig, devices } from '@playwright/test'
import { RECORDING } from './src/raw'
import { PORTS, VIEWPORT } from './src/constants.mjs'

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
    { name: 'react', use: { baseURL: `http://localhost:${PORTS.react}` } },
    { name: 'ember', use: { baseURL: `http://localhost:${PORTS.ember}` } },
  ],
  webServer: [
    {
      command: 'pnpm serve:react',
      url: `http://localhost:${PORTS.react}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
    },
    {
      command: 'pnpm serve:ember',
      url: `http://localhost:${PORTS.ember}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
    },
  ],
})
