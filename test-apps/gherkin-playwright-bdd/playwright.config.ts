import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const port = Number(process.env.FIXTURE_PORT || 5187)

/** The shared harness-world feature, under playwright-bdd and the Playwright driver. */
const testDir = defineBddConfig({
  featuresRoot: '../../packages/gherkin/features',
  features: '../../packages/gherkin/features/*.feature',
  steps: 'steps/*.ts',
})

export default defineConfig({
  testDir,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
  webServer: {
    command: `FIXTURE_PORT=${port} pnpm --filter conformance serve:fixture`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
  },
})
