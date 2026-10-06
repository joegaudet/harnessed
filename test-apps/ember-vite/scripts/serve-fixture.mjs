// Usage: FIXTURE_PORT=<port> node scripts/serve-fixture.mjs
// Builds the app into tmp/serve-<port> while holding the app's build lock, so
// e2e runs started together take turns building, then serves that build with
// `vite preview` on the port. Each port gets its own build, so a later run
// never rewrites the files an earlier one is serving.
import { acquireLock, BUILD_LOCK } from './build-lock.mjs'
import { run } from './run.mjs'

const port = process.env.FIXTURE_PORT || '4200'
const outDir = `tmp/serve-${port}`

const release = await acquireLock(BUILD_LOCK)
let built
try {
  built = await run('vite', ['build', '--mode', 'development', '--outDir', outDir])
} finally {
  release()
}
process.exitCode = built
if (built === 0) {
  process.exitCode = await run('vite', [
    'preview',
    '--outDir',
    outDir,
    '--port',
    port,
    '--strictPort',
  ])
}
