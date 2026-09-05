import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import type { HarnessedConfig } from '@harnessed-ts/core'
import { createJiti } from 'jiti'

export type { HarnessedConfig }

/** Tried in order; the first that exists wins. */
const FILENAMES = [
  'harnessed.config.ts',
  'harnessed.config.mts',
  'harnessed.config.js',
  'harnessed.config.mjs',
]

const cache = new Map<string, HarnessedConfig | undefined>()

/** The config file's path, if a repo has one. */
export function findConfig(root: string = process.cwd()): string | undefined {
  return FILENAMES.map(name => join(root, name)).find(existsSync)
}

/**
 * Reads `harnessed.config.ts` from disk.
 *
 * Synchronous and TypeScript-capable, because the callers are an ESLint rule and
 * a CLI — neither of which runs inside a bundler that would transform the file
 * for them. That is what `jiti` is for, and why this is a separate package:
 * `@harnessed-ts/core` stays dependency-free and usable in a browser.
 *
 * Cached per root: an ESLint run asks once per file, and the answer cannot change
 * within a run.
 */
export function loadConfig(root: string = process.cwd()): HarnessedConfig | undefined {
  if (cache.has(root)) return cache.get(root)

  const file = findConfig(root)
  let config: HarnessedConfig | undefined
  if (file !== undefined) {
    const jiti = createJiti(root, { interopDefault: true })
    const loaded = jiti(file) as HarnessedConfig | { default?: HarnessedConfig }
    config =
      'default' in loaded && loaded.default !== undefined
        ? loaded.default
        : (loaded as HarnessedConfig)
  }

  cache.set(root, config)
  return config
}

/**
 * The config governing a particular file, found by walking up from it.
 *
 * Resolving from the file rather than the process's working directory is what
 * makes this correct for a monorepo, and for an editor or a lint run started from
 * anywhere other than the repo root — `cwd` says where the tool was invoked,
 * which is not a fact about the code being checked.
 */
export function loadConfigFor(filename: string): HarnessedConfig | undefined {
  const { root } = parse(filename)
  let dir = dirname(filename)
  for (;;) {
    if (findConfig(dir) !== undefined) return loadConfig(dir)
    if (dir === root) return undefined
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/** Forgets what was loaded. For tests, and for a long-lived editor process. */
export function clearConfigCache(): void {
  cache.clear()
}
