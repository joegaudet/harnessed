import { spawn } from 'node:child_process'
import { constants } from 'node:os'

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

/**
 * Runs `command` with this process's stdio, passing on the signals that stop
 * this process, and resolves with its exit code (128 + n if a signal ended it).
 */
export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    const forward = signal => child.kill(signal)
    SIGNALS.forEach(signal => process.on(signal, forward))
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      SIGNALS.forEach(signal => process.off(signal, forward))
      resolve(code ?? 128 + constants.signals[signal])
    })
  })
}
