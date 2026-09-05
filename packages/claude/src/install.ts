import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectLayout, detectTestIdAttribute } from './detect'
import type { RenderContext } from './render'
import { renderConfig, renderRules, renderSkill } from './render'

export interface InstallOptions {
  /** Repo root. Defaults to the working directory. */
  root?: string
  /** Overrides for anything detection got wrong. */
  layout?: Partial<RenderContext>
  /** Report what would change without writing. */
  dryRun?: boolean
  /** Rewrite an existing harnessed.config.ts. Off by default. */
  overwriteConfig?: boolean
}

export interface InstallResult {
  context: RenderContext
  written: string[]
  skipped: string[]
}

function assetsDir(): string {
  // dist/ sits one level below the package root, where assets/ lives.
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [join(here, '..', 'assets'), join(here, 'assets')]
  const found = candidates.find(existsSync)
  if (found === undefined) {
    throw new Error(
      `harnessed: could not find the packaged assets (looked in ${candidates.join(', ')})`,
    )
  }
  return found
}

function write(path: string, contents: string, result: InstallResult, dryRun: boolean): void {
  if (dryRun) {
    result.written.push(path)
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
  result.written.push(path)
}

/**
 * Writes the authoring skill, the rules file, and the templates into a repo's
 * `.claude/`, with the placement table generated from that repo's own layout.
 *
 * Safe to re-run after an upgrade: the shipped law is refreshed, and an existing
 * `harnessed.config.ts` is left alone unless asked for.
 */
export function install(options: InstallOptions = {}): InstallResult {
  const root = resolve(options.root ?? process.cwd())
  const dryRun = options.dryRun ?? false
  const assets = assetsDir()

  const detected = detectLayout(root)
  const context: RenderContext = {
    ...detected,
    testIdAttribute: detectTestIdAttribute(root),
    ...options.layout,
  }

  const result: InstallResult = { context, written: [], skipped: [] }

  const skillTemplate = readFileSync(join(assets, 'skills/harness/SKILL.md'), 'utf8')
  write(
    join(root, '.claude/skills/harness/SKILL.md'),
    renderSkill(skillTemplate, context),
    result,
    dryRun,
  )

  const rulesTemplate = readFileSync(join(assets, 'rules/harness.md'), 'utf8')
  write(join(root, '.claude/rules/harness.md'), renderRules(rulesTemplate, context), result, dryRun)

  for (const template of ['component-harness-template.ts', 'route-harness-template.ts']) {
    // Through `write` rather than copyFileSync, so dry-run semantics cannot
    // diverge between the rendered files and the copied ones.
    write(
      join(root, '.claude/skills/harness/examples', template),
      readFileSync(join(assets, 'skills/harness/examples', template), 'utf8'),
      result,
      dryRun,
    )
  }

  const configPath = join(root, 'harnessed.config.ts')
  if (existsSync(configPath) && options.overwriteConfig !== true) {
    // The config is the repo's to own; only the generated docs are ours.
    result.skipped.push(configPath)
  } else {
    write(configPath, renderConfig(context), result, dryRun)
  }

  return result
}
