import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { FIXTURE_PORT, FIXTURE_URL } from './fixture-url'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const STARTUP_MS = 60_000

async function answers(): Promise<boolean> {
  try {
    return (await fetch(FIXTURE_URL)).ok
  } catch {
    return false
  }
}

async function waitUntilServing(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_MS
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`the fixture server exited with code ${server.exitCode} before serving`)
    }
    if (await answers()) return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`the fixture server did not answer on ${FIXTURE_URL} within ${STARTUP_MS}ms`)
}

/**
 * Vitest global setup: serves the React fixture the catalog's views live in, the
 * way Playwright's `webServer` does for the reference run. Outside CI a server
 * already on the port is reused, so a watch loop does not pay Vite's startup.
 */
export default async function setup(): Promise<() => void> {
  if (!process.env.CI && (await answers())) return () => {}

  const server = spawn('pnpm', ['--filter', 'conformance', 'serve:fixture'], {
    cwd: REPO_ROOT,
    env: { ...process.env, FIXTURE_PORT: String(FIXTURE_PORT) },
    // Its own process group, so teardown stops Vite and not just the pnpm wrapper.
    detached: true,
    stdio: 'ignore',
  })
  const stop = (): void => {
    if (server.pid !== undefined && server.exitCode === null) process.kill(-server.pid, 'SIGTERM')
  }
  try {
    await waitUntilServing(server)
  } catch (error) {
    stop()
    throw error
  }
  return stop
}
