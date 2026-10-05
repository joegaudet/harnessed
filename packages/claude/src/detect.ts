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

/** The runners `install` knows how to document, in the order they are shown. */
export const RUNNERS = [
  'ember',
  'cypress',
  'webdriverio',
  'testcafe',
  'puppeteer',
  'playwright',
  'vitest-browser',
  'testing-library',
  'gherkin',
] as const

export type Runner = (typeof RUNNERS)[number]

/** The `@harnessed-ts/gherkin` entry points, one per Gherkin runner. */
export const GHERKIN_ADAPTERS = ['playwright-bdd', 'cucumber', 'cypress', 'yadda'] as const

export type GherkinAdapter = (typeof GHERKIN_ADAPTERS)[number]

export function isRunner(value: unknown): value is Runner {
  return RUNNERS.some(runner => runner === value)
}

/**
 * Checks runners handed over from outside the type system — a flag, a config,
 * a JavaScript caller — and names the first one it does not know.
 */
export function toRunners(values: unknown): Runner[] {
  if (!Array.isArray(values)) {
    throw new Error(
      `harnessed: runners must be a list, got ${JSON.stringify(values)} (known: ${RUNNERS.join(', ')})`,
    )
  }
  return values.map((value: unknown) => {
    if (isRunner(value)) return value
    throw new Error(
      `harnessed: unknown runner ${JSON.stringify(value)} (known: ${RUNNERS.join(', ')})`,
    )
  })
}

/** `ember, cypress` → `['ember', 'cypress']`; an empty list is no runners. */
export function parseRunners(list: string): Runner[] {
  return toRunners(
    list
      .split(',')
      .map(item => item.trim())
      .filter(item => item !== ''),
  )
}

interface RunnerSignal {
  runner: Runner
  /** A dependency that means the repo uses it. */
  packages: RegExp
  /** A file a project using it leaves at its root. */
  files?: string[]
}

const RUNNER_SIGNALS: RunnerSignal[] = [
  {
    runner: 'ember',
    packages: /^ember-source$/,
    files: ['ember-cli-build.js', 'ember-cli-build.mjs'],
  },
  {
    runner: 'cypress',
    packages: /^cypress$/,
    files: ['cypress.config.ts', 'cypress.config.js', 'cypress.config.mjs'],
  },
  {
    runner: 'webdriverio',
    packages: /^(webdriverio|@wdio\/cli)$/,
    files: ['wdio.conf.ts', 'wdio.conf.js', 'wdio.conf.mjs'],
  },
  {
    runner: 'testcafe',
    packages: /^testcafe$/,
    files: ['.testcaferc.json', '.testcaferc.js', '.testcaferc.cjs'],
  },
  { runner: 'puppeteer', packages: /^puppeteer(-core)?$/ },
  { runner: 'playwright', packages: /^@playwright\/test$/ },
  { runner: 'vitest-browser', packages: /^@vitest\/browser/ },
  {
    runner: 'testing-library',
    packages: /^@testing-library\/(dom|react|vue|svelte|angular|preact|ember)$/,
  },
  {
    runner: 'gherkin',
    packages:
      /^(playwright-bdd|@cucumber\/cucumber|@badeball\/cypress-cucumber-preprocessor|ember-cli-yadda)$/,
  },
]

/** The package that means a repo runs Gherkin through each adapter. */
const GHERKIN_SIGNALS: Record<GherkinAdapter, string> = {
  'playwright-bdd': 'playwright-bdd',
  cucumber: '@cucumber/cucumber',
  cypress: '@badeball/cypress-cucumber-preprocessor',
  yadda: 'ember-cli-yadda',
}

const MANIFEST_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

function readManifest(dir: string): Record<string, unknown> | undefined {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return typeof manifest === 'object' && manifest !== null
      ? (manifest as Record<string, unknown>)
      : undefined
  } catch {
    // No manifest, or an unreadable one: only the config files can tell.
    return undefined
  }
}

function dependencyNames(manifest: Record<string, unknown> | undefined): string[] {
  if (manifest === undefined) return []
  return MANIFEST_FIELDS.flatMap(field => {
    const deps = manifest[field]
    return typeof deps === 'object' && deps !== null ? Object.keys(deps) : []
  })
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

/** The `packages:` list of a pnpm-workspace.yaml: just enough YAML for that one key. */
function pnpmWorkspaceGlobs(root: string): string[] | undefined {
  let text: string
  try {
    text = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
  } catch {
    return undefined
  }
  const globs: string[] = []
  let inPackages = false
  for (const line of text.split(/\r?\n/)) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true
      continue
    }
    if (!inPackages || line.trim() === '' || line.trim().startsWith('#')) continue
    const item = /^\s+-\s*(.+?)\s*$/.exec(line)
    if (item === null) {
      // The next top-level key ends the list.
      if (/^\S/.test(line)) inPackages = false
      continue
    }
    globs.push(item[1]!.replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2'))
  }
  return globs
}

/** The workspace globs a repo declares, from package.json or pnpm-workspace.yaml. */
function workspaceGlobs(root: string, manifest: Record<string, unknown> | undefined): string[] {
  const workspaces = manifest?.workspaces
  const fromManifest = isStringArray(workspaces)
    ? workspaces
    : typeof workspaces === 'object' && workspaces !== null
      ? (workspaces as Record<string, unknown>).packages
      : undefined
  return [...(isStringArray(fromManifest) ? fromManifest : []), ...(pnpmWorkspaceGlobs(root) ?? [])]
}

const MAX_DEPTH = 5

function childDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(
        entry =>
          entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.'),
      )
      .map(entry => entry.name)
  } catch {
    return []
  }
}

function segmentPattern(segment: string): RegExp {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replaceAll('*', '[^/]*').replaceAll('?', '[^/]')}$`)
}

/** The directories under `dir` a workspace glob matches: `*`, `?` and `**`, nothing fancier. */
function expandGlob(dir: string, segments: string[], depth: number): string[] {
  if (segments.length === 0) return [dir]
  if (depth > MAX_DEPTH) return []
  const [head, ...rest] = segments
  if (head === '**') {
    return [
      ...expandGlob(dir, rest, depth),
      ...childDirs(dir).flatMap(child => expandGlob(join(dir, child), segments, depth + 1)),
    ]
  }
  if (head === '.' || head === '') return expandGlob(dir, rest, depth)
  if (!/[*?]/.test(head!)) {
    const next = join(dir, head!)
    return existsSync(next) && head !== 'node_modules' ? expandGlob(next, rest, depth + 1) : []
  }
  const pattern = segmentPattern(head!)
  return childDirs(dir)
    .filter(child => pattern.test(child))
    .flatMap(child => expandGlob(join(dir, child), rest, depth + 1))
}

/**
 * Every directory whose manifest and config files count: the root, plus its
 * workspace packages. Those come from the `workspaces` field or
 * pnpm-workspace.yaml when the repo declares them, and otherwise from any
 * package one or two levels down — a tooling-only root with the app in
 * `apps/web` is the common monorepo, and its runners live with the app.
 */
function packageDirs(root: string, manifest: Record<string, unknown> | undefined): string[] {
  const globs = workspaceGlobs(root, manifest)
  const hasManifest = (dir: string): boolean => existsSync(join(dir, 'package.json'))
  if (globs.length === 0) {
    const oneDown = childDirs(root).map(child => join(root, child))
    const twoDown = oneDown.flatMap(dir => childDirs(dir).map(child => join(dir, child)))
    return [root, ...[...oneDown, ...twoDown].filter(hasManifest)]
  }
  const expand = (glob: string): string[] => expandGlob(root, glob.split('/'), 0)
  const excluded = new Set(
    globs.filter(glob => glob.startsWith('!')).flatMap(glob => expand(glob.slice(1))),
  )
  const included = globs
    .filter(glob => !glob.startsWith('!'))
    .flatMap(expand)
    .filter(dir => !excluded.has(dir) && hasManifest(dir))
  return [root, ...new Set(included)]
}

interface RepoEvidence {
  dependencies: Set<string>
  /** Whether any of the repo's package directories holds this file. */
  hasFile(name: string): boolean
}

function evidence(root: string): RepoEvidence {
  const rootManifest = readManifest(root)
  const dirs = packageDirs(root, rootManifest)
  const dependencies = new Set(
    dirs.flatMap(dir => dependencyNames(dir === root ? rootManifest : readManifest(dir))),
  )
  return {
    dependencies,
    hasFile: name => dirs.some(dir => existsSync(join(dir, name))),
  }
}

/**
 * The test runners a repo uses, from its dependencies and the config files each
 * runner leaves behind — at the root and in each workspace package. The skill
 * documents only these, so an agent working in an Ember repo is shown `ember()`
 * and `assert.harness`, not Cypress.
 */
export function detectRunners(root: string): Runner[] {
  const { dependencies, hasFile } = evidence(root)
  return RUNNER_SIGNALS.filter(
    ({ packages, files = [] }) =>
      [...dependencies].some(name => packages.test(name)) || files.some(hasFile),
  ).map(({ runner }) => runner)
}

/** Which `@harnessed-ts/gherkin` adapters the repo needs, by its Gherkin runners. */
export function detectGherkinAdapters(root: string): GherkinAdapter[] {
  const { dependencies } = evidence(root)
  return GHERKIN_ADAPTERS.filter(adapter => dependencies.has(GHERKIN_SIGNALS[adapter]))
}

/** Whether Ember tests here may run under Vitest (`ember-vitest`) rather than QUnit alone. */
export function detectEmberUnderVitest(root: string): boolean {
  const { dependencies } = evidence(root)
  return dependencies.has('ember-vitest') || dependencies.has('vitest')
}
