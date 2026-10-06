import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const made: string[] = []

/** A throwaway repo holding exactly these files. Removed by `removeRepos`. */
export function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'harnessed-claude-'))
  made.push(root)
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

/** Deletes every repo `repo` made so far. Register it with `afterEach`. */
export function removeRepos(): void {
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true })
}

/** A manifest with these devDependencies. */
export const pkg = (deps: Record<string, string>): string =>
  JSON.stringify({ name: 'app', devDependencies: deps })
