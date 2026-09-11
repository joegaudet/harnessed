import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface DetectedLayout {
  components: string
  pages: string
  harnesses: string
  /** Where widget harnesses go. May be a subdirectory of `harnesses`. */
  widgetHarnesses: string
  /** Where page harnesses go. May be a subdirectory of `harnesses`. */
  pageHarnesses: string
  widgetTestId: string
  pageTestId: string
}

const COMPONENT_CANDIDATES = [
  'src/components',
  'app/components',
  'src/lib/components',
  'components',
]
const PAGE_CANDIDATES = ['src/pages', 'src/screens', 'app/routes', 'src/views', 'pages']
const HARNESS_CANDIDATES = ['harness', 'harnesses', 'test/harness', 'tests/harness']

function firstExisting(root: string, candidates: string[]): string | undefined {
  return candidates.find(candidate => {
    const full = join(root, candidate)
    return existsSync(full) && statSync(full).isDirectory()
  })
}

/**
 * The test-id attribute already in use, if the repo has settled on one.
 *
 * One walk testing every candidate, rather than a walk per candidate: the old
 * shape read every source file up to three times whenever the repo used the
 * last candidate or none of them.
 */
export function detectTestIdAttribute(root: string): string {
  const candidates = ['data-testid', 'data-test-id', 'data-test']
  const searchRoots = ['src', 'app', 'lib'].map(dir => join(root, dir)).filter(existsSync)
  for (const dir of searchRoots) {
    const found = firstNeedle(dir, candidates, 0)
    if (found !== undefined) return found
  }
  return candidates[0]!
}

function firstNeedle(dir: string, needles: string[], depth: number): string | undefined {
  if (depth > 3) return undefined
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = firstNeedle(full, needles, depth + 1)
      if (found !== undefined) return found
      continue
    }
    if (!/\.(tsx?|jsx?|vue|svelte)$/.test(entry.name)) continue
    try {
      const contents = readFileSync(full, 'utf8')
      // Candidates are in priority order, so the first hit in this file wins.
      const hit = needles.find(needle => contents.includes(needle))
      if (hit !== undefined) return hit
    } catch {
      continue
    }
  }
  return undefined
}

/**
 * Guesses the repo's layout so the generated placement table matches where things
 * actually live. Guesses, not rules — the CLI shows them and takes an override.
 */
export function detectLayout(root: string): DetectedLayout {
  const harnesses = firstExisting(root, HARNESS_CANDIDATES) ?? 'harness'
  // An existing tree is the best evidence of where new harnesses belong.
  const widgetHarnesses =
    firstExisting(root, [
      join(harnesses, 'components/ui'),
      join(harnesses, 'components/widgets'),
      join(harnesses, 'components'),
    ]) ?? harnesses
  const pageHarnesses =
    firstExisting(root, [
      join(harnesses, 'components/pages'),
      join(harnesses, 'pages'),
      join(harnesses, 'components/screens'),
      join(harnesses, 'screens'),
      join(harnesses, 'components'),
    ]) ?? harnesses
  return {
    components: firstExisting(root, COMPONENT_CANDIDATES) ?? 'src/components',
    pages: firstExisting(root, PAGE_CANDIDATES) ?? 'src/pages',
    harnesses,
    widgetHarnesses,
    pageHarnesses,
    widgetTestId: 'ui-<kebab>',
    pageTestId: 'page-<kebab>',
  }
}
