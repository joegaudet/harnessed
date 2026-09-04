import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface DetectedLayout {
  components: string
  screens: string
  harnesses: string
  widgetTestId: string
  screenTestId: string
}

const COMPONENT_CANDIDATES = [
  'src/components',
  'app/components',
  'src/lib/components',
  'components',
]
const SCREEN_CANDIDATES = ['src/screens', 'src/pages', 'app/routes', 'src/views', 'pages']
const HARNESS_CANDIDATES = ['harness', 'harnesses', 'test/harness', 'tests/harness']

function firstExisting(root: string, candidates: string[]): string | undefined {
  return candidates.find(candidate => {
    const full = join(root, candidate)
    return existsSync(full) && statSync(full).isDirectory()
  })
}

/** The test-id attribute already in use, if the repo has settled on one. */
export function detectTestIdAttribute(root: string): string {
  const conventional = ['data-testid', 'data-test-id', 'data-test']
  const searchRoots = ['src', 'app', 'lib'].map(dir => join(root, dir)).filter(existsSync)
  for (const attribute of conventional) {
    if (searchRoots.some(dir => containsText(dir, attribute, 0))) return attribute
  }
  return 'data-testid'
}

function containsText(dir: string, needle: string, depth: number): boolean {
  if (depth > 3) return false
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return false
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    let info
    try {
      info = statSync(full)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      if (containsText(full, needle, depth + 1)) return true
      continue
    }
    if (!/\.(tsx?|jsx?|vue|svelte)$/.test(entry)) continue
    try {
      if (readFileSync(full, 'utf8').includes(needle)) return true
    } catch {
      continue
    }
  }
  return false
}

/**
 * Guesses the repo's layout so the generated placement table matches where things
 * actually live. Guesses, not rules — the CLI shows them and takes an override.
 */
export function detectLayout(root: string): DetectedLayout {
  return {
    components: firstExisting(root, COMPONENT_CANDIDATES) ?? 'src/components',
    screens: firstExisting(root, SCREEN_CANDIDATES) ?? 'src/screens',
    harnesses: firstExisting(root, HARNESS_CANDIDATES) ?? 'harness',
    widgetTestId: 'ui-<kebab>',
    screenTestId: 'screen-<kebab>',
  }
}
