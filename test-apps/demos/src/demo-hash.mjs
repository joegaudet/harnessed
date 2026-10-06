// Pins the README's GIFs to the demo.ts they were recorded from. `record`
// writes the hash; rtl/demo.test.ts checks the current demo.ts against it.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Paths, not `new URL(..., import.meta.url)`: Vite rewrites that form into an
// asset import, and under Vitest it would resolve to nothing (see src/raw.ts).
const APP = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = join(APP, '..', '..')
const DEMO = join(APP, 'src', 'demo.ts')

/** Where the hash lives, beside the GIFs, relative to the repo root. */
export const DEMO_HASH_FILE = 'docs/media/demo.sha256'

/**
 * The line the hash file holds for the current demo.ts, in `sha256sum` format,
 * so `shasum -a 256 -c docs/media/demo.sha256` from the repo root checks it too.
 */
export function demoHashLine() {
  const hash = createHash('sha256').update(readFileSync(DEMO)).digest('hex')
  return `${hash}  ${relative(REPO, DEMO)}\n`
}

/** The hash file's line, or null if there is none yet. */
export function readDemoHash() {
  try {
    return readFileSync(join(REPO, DEMO_HASH_FILE), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export function writeDemoHash() {
  writeFileSync(join(REPO, DEMO_HASH_FILE), demoHashLine())
}
