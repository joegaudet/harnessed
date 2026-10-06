import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const appRoot = new URL('..', import.meta.url).pathname

/** A port nothing is listening on right now. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

/**
 * `pnpm run serve:fixture` on `port`, in a process group of its own, so the
 * whole tree (pnpm, the script, vite preview) can be stopped together.
 */
function serve(port) {
  const child = spawn('pnpm', ['run', 'serve:fixture'], {
    cwd: appRoot,
    env: { ...process.env, FIXTURE_PORT: String(port) },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => (output += chunk))
  child.stderr.on('data', chunk => (output += chunk))
  const exited = new Promise(resolve => child.on('exit', code => resolve(code)))
  return {
    port,
    exited,
    output: () => output,
    stop() {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        // Already gone.
      }
    },
  }
}

/** Resolves with the response once `url` answers 200, or throws if `server` exits first. */
async function whenServing(server, path, deadline) {
  const url = `http://localhost:${server.port}${path}`
  let exitCode
  server.exited.then(code => (exitCode = code))
  while (Date.now() < deadline) {
    if (exitCode !== undefined) {
      throw new Error(`serve:fixture on ${server.port} exited (${exitCode}):\n${server.output()}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // Not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`serve:fixture on ${server.port} never served ${path}:\n${server.output()}`)
}

/** The app is up when its page and every script the page loads come back 200. */
async function assertServesTheApp(server, deadline) {
  const html = await (await whenServing(server, '/', deadline)).text()
  assert.match(html, /<title>EmberVite<\/title>/)
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(match => match[1])
  assert.ok(scripts.length > 0, `no scripts in the page on ${server.port}:\n${html}`)
  for (const src of scripts) {
    const response = await fetch(new URL(src, `http://localhost:${server.port}/`))
    assert.equal(response.status, 200, `${src} on ${server.port}`)
  }
}

// Every `vite build` runs Embroider's compat prebuild into one fixed directory,
// so two runs building at once used to corrupt each other's output.
test(
  'two serve:fixture runs started together both serve the app',
  { timeout: 180_000 },
  async () => {
    const servers = [serve(await freePort()), serve(await freePort())]
    try {
      const deadline = Date.now() + 170_000
      await Promise.all(servers.map(server => assertServesTheApp(server, deadline)))
    } finally {
      servers.forEach(server => server.stop())
      await Promise.all(servers.map(server => server.exited))
      servers.forEach(({ port }) =>
        rmSync(new URL(`tmp/serve-${port}`, `file://${appRoot}`), { recursive: true, force: true }),
      )
    }
  },
)
