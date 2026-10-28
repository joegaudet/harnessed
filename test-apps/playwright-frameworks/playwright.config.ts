import { defineConfig, devices } from '@playwright/test'

/**
 * Each framework port of the fixture: the test app that builds and serves it,
 * and the port it is served on. Add a port here and it gets its own project and
 * web server.
 */
const PORTS = {
  vue: { app: 'test-app-vue', port: 5191 },
  solid: { app: 'test-app-solid', port: 5192 },
  svelte: { app: 'test-app-svelte', port: 5193 },
  // angular: { app: 'test-app-angular', port: 5194 },
} as const satisfies Record<string, { app: string; port: number }>

type Framework = keyof typeof PORTS

/**
 * `FRAMEWORK=vue` (or `vue,svelte`) runs only those ports. Playwright starts
 * every configured web server whatever `--project` says, so the selection
 * happens here, where it also decides which apps get built and served.
 */
function selected(): Framework[] {
  const all = Object.keys(PORTS) as Framework[]
  const wanted = (process.env.FRAMEWORK || '').split(',').filter(name => name !== '')
  if (wanted.length === 0) return all
  const unknown = wanted.filter(name => !(name in PORTS))
  if (unknown.length > 0) {
    throw new Error(`FRAMEWORK names ${unknown.join(', ')}; known: ${all.join(', ')}`)
  }
  return wanted as Framework[]
}

const frameworks = selected()

/**
 * The Playwright reference run — the very spec files `packages/conformance` runs
 * against the React fixture: `specs`, `pageSpecs` and `urlSpecs` — pointed at
 * each framework's port of the fixture, built by Vite and served as a real app
 * in a real browser. Those specs import `@playwright/test` from
 * packages/conformance, so its version and this app's must stay the same: two
 * copies refuse to load together.
 */
export default defineConfig({
  testDir: new URL('../../packages/conformance/specs', import.meta.url).pathname,
  testMatch: '*.spec.ts',
  outputDir: new URL('test-results', import.meta.url).pathname,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  projects: frameworks.map(name => ({
    name,
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORTS[name].port}` },
  })),
  webServer: frameworks.map(name => ({
    // Builds the app, then serves the build with an SPA fallback, so every
    // path boots the app and it routes to the fixture view.
    command: `FIXTURE_PORT=${PORTS[name].port} pnpm --filter ${PORTS[name].app} serve:fixture`,
    url: `http://localhost:${PORTS[name].port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
  })),
})
