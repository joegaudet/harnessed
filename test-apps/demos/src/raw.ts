import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EnvId } from './timeline'

/** True when a run is recording footage rather than only checking the demo. */
export const RECORDING = process.env.DEMO_RECORD === '1'

// A path, not `new URL(..., import.meta.url)`: Vite rewrites that form into an
// asset import, and under Vitest the folder would resolve to nothing.
const APP = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where a recording's raw footage and timeline go. Git ignores the whole folder. */
export function rawDir(env: EnvId): string {
  const dir = join(APP, 'raw', env)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function writeJson(env: EnvId, name: string, value: unknown): void {
  writeFileSync(join(rawDir(env), name), `${JSON.stringify(value, null, 2)}\n`)
}
