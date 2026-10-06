// Usage: node scripts/with-build-lock.mjs <command> [args...]
// Runs the command while holding the app's build lock (see build-lock.mjs).
import { acquireLock, BUILD_LOCK } from './build-lock.mjs'
import { run } from './run.mjs'

const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('usage: with-build-lock.mjs <command> [args...]')

const release = await acquireLock(BUILD_LOCK)
try {
  process.exitCode = await run(command, args)
} finally {
  release()
}
