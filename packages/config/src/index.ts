import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

/** `dir` and every directory above it, nearest first. */
function ancestors(dir: string): string[] {
  const dirs = [dir]
  for (let parent = dirname(dir); parent !== dirs.at(-1); parent = dirname(parent)) {
    dirs.push(parent)
  }
  return dirs
}

const hasManifest = (dir: string): boolean => existsSync(join(dir, 'package.json'))

/** A git checkout's root, or the root of a pnpm, npm or yarn workspace. */
function isRepoRoot(dir: string): boolean {
  if (existsSync(join(dir, '.git')) || existsSync(join(dir, 'pnpm-workspace.yaml'))) return true
  if (!hasManifest(dir)) return false
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return typeof manifest === 'object' && manifest !== null && 'workspaces' in manifest
  } catch {
    return false
  }
}

/**
 * The config governing a particular file, found by walking up from it.
 *
 * Resolving from the file rather than the process's working directory is what
 * makes this correct for a monorepo, and for an editor or a lint run started from
 * anywhere other than the repo root — `cwd` says where the tool was invoked,
 * which is not a fact about the code being checked.
 *
 * The walk stops at the project root, checking that directory itself last.
 * Loading a config executes it, so a `harnessed.config.ts` above the project — in
 * a home directory, a shared parent, `/tmp` — must never be picked up. The root is
 * the nearest git checkout or workspace root (`.git`, `pnpm-workspace.yaml`, or a
 * `package.json` with `workspaces`), not the nearest `package.json`: in a monorepo
 * the file's own package has a `package.json`, and the config usually sits at the
 * workspace root above it. Outside any checkout or workspace, the nearest
 * `package.json` is the root. With neither, there is no project, and no config.
 */
export function loadConfigFor(filename: string): HarnessedConfig | undefined {
  const dirs = ancestors(dirname(filename))
  const root = dirs.find(isRepoRoot) ?? dirs.find(hasManifest)
  if (root === undefined) return undefined
  for (const dir of dirs.slice(0, dirs.indexOf(root) + 1)) {
    if (findConfig(dir) !== undefined) return loadConfig(dir)
  }
  return undefined
}

/** Forgets what was loaded. For tests, and for a long-lived editor process. */
export function clearConfigCache(): void {
  cache.clear()
}
