// Usage: FIXTURE_PORT=<port> node scripts/serve-fixture.mjs
// Builds the app into tmp/serve-<port>, then serves that build with `vite
// preview` on the port. Preview falls back to index.html for unknown paths (the
// config's appType is 'spa'), so /step-two boots the app. Each port gets its own
// build, so a later run never rewrites the files an earlier one is serving.
import { spawn } from 'node:child_process'
import { constants } from 'node:os'

const port = process.env.FIXTURE_PORT || '5193'
const outDir = `tmp/serve-${port}`
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

/** Runs vite with this process's stdio, passing on the signals that stop this process. */
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

const built = await vite(['build', '--outDir', outDir, '--emptyOutDir'])
process.exitCode = built
if (built === 0) {
  process.exitCode = await vite(['preview', '--outDir', outDir, '--port', port, '--strictPort'])
}
