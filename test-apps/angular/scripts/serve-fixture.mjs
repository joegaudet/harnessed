// Usage: FIXTURE_PORT=<port> node scripts/serve-fixture.mjs
// Builds the app into tmp/serve-<port>, then serves that build with
// `vite preview` on the port. `appType: 'spa'` makes the preview fall back to
// index.html, so every path boots the app and its router reads the URL. Each
// port gets its own build, so a later run never rewrites the files an earlier
// one is serving.
import { spawn } from 'node:child_process'
import { constants } from 'node:os'

const port = process.env.FIXTURE_PORT || '5194'
const outDir = `tmp/serve-${port}`
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

/**
 * Runs `vite` with these arguments and this process's stdio, passing on the
 * signals that stop this process, and resolves with its exit code (128 + n if
 * a signal ended it).
 */
function vite(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('vite', args, { stdio: 'inherit' })
    const forward = signal => child.kill(signal)
    SIGNALS.forEach(signal => process.on(signal, forward))
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      SIGNALS.forEach(signal => process.off(signal, forward))
      resolve(code ?? 128 + constants.signals[signal])
    })
  })
}

const built = await vite(['build', '--outDir', outDir])
process.exitCode = built
if (built === 0) {
  process.exitCode = await vite(['preview', '--outDir', outDir, '--port', port, '--strictPort'])
}
