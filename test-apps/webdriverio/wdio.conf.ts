import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { connect } from 'node:net'

/** This runner's own fixture port, so it can run beside the other drivers' runners. */
const FIXTURE_PORT = 5182

let server: ChildProcess | undefined

function portIsOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect(port, 'localhost')
    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

async function waitForPort(port: number, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout
  while (!(await portIsOpen(port))) {
    if (Date.now() > deadline) throw new Error(`the fixture did not start on port ${port}`)
    await new Promise(resolve => setTimeout(resolve, 200))
  }
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': { args: ['--headless=new', '--window-size=1280,800'] },
    },
  ],
  logLevel: 'warn',
  baseUrl: `http://localhost:${FIXTURE_PORT}`,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 60_000 },

  /**
   * Serves the React fixture for the run, as Playwright's `webServer` does for the
   * reference runner. A fixture already listening on the port is reused, so a
   * developer can keep one running while iterating.
   */
  async onPrepare() {
    if (await portIsOpen(FIXTURE_PORT)) return
    server = spawn('pnpm', ['--filter', '@harnessed-ts/conformance', 'serve:fixture'], {
      env: { ...process.env, FIXTURE_PORT: String(FIXTURE_PORT) },
      stdio: 'ignore',
      // Its own process group, so stopping it also stops the Vite child pnpm starts.
      detached: true,
    })
    await waitForPort(FIXTURE_PORT, 60_000)
  },

  onComplete() {
    if (server?.pid !== undefined) process.kill(-server.pid)
  },
}
