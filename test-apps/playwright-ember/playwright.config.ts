import { defineConfig, devices } from '@playwright/test'

// This app's own port, so it can run beside the React fixture's runners.
const port = Number(process.env.FIXTURE_PORT || 5190)

/**
 * The Playwright reference run — the very spec files `packages/conformance` runs
 * against the React fixture — pointed at the Glimmer port of the fixture, built
 * by Embroider + Vite and served as a real app in a real browser. Those specs
 * import `@playwright/test` from packages/conformance, so its version and this
 * app's must stay the same: two copies refuse to load together.
 */
export default defineConfig({
  testDir: new URL('../../packages/conformance/specs', import.meta.url).pathname,
  testMatch: '*.spec.ts',
  outputDir: new URL('test-results', import.meta.url).pathname,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
  webServer: {
    // Builds the Ember app, then serves the build with an SPA fallback, so every
    // path boots the app and its router renders the fixture.
    command: `FIXTURE_PORT=${port} pnpm --filter test-app-ember-vite serve:fixture`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
  },
})
