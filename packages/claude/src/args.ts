import { parseRunners, RUNNERS } from './detect'
import type { RenderContext } from './render'

const OPTION_INDENT = ' '.repeat(24)

/** The known runners, a few to a line, aligned under the option descriptions. */
const knownRunners = RUNNERS.reduce<string[][]>((lines, runner, index) => {
  if (index % 5 === 0) lines.push([])
  lines.at(-1)!.push(runner)
  return lines
}, [])
  .map(line => `${OPTION_INDENT}${line.join(', ')}`)
  .join(',\n')

export const USAGE = `harnessed-claude — install the harness authoring skill and rules

Usage
  npx @harnessed-ts/claude install [options]

Options
  --dry-run             Report what would change, write nothing
  --overwrite-config    Rewrite an existing harnessed.config.ts
  --components <dir>    Where reusable widgets live
  --pages <dir>         Where pages live
  --harnesses <dir>     Where harnesses should be written
  --widget-harnesses <dir>  Where widget harnesses go (default: detected)
  --page-harnesses <dir>    Where page harnesses go (default: detected)
  --test-id-attr <str>  The test-id attribute in use (default: detected)
  --widget-testid <p>   Widget test-id pattern (default: ui-<kebab>)
  --page-testid <p>     Page test-id pattern (default: page-<kebab>)
  --runners <list>      The test runners to document, comma-separated
                        (default: detected). One or more of:
${knownRunners}
  -h, --help            Show this
`

export interface ParsedArgs {
  command: string
  layout: Partial<RenderContext>
  dryRun: boolean
  overwriteConfig: boolean
  help: boolean
}

/** The CLI's arguments. Throws, with a message fit for the terminal, on a bad one. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const layout: Partial<RenderContext> = {}
  let dryRun = false
  let overwriteConfig = false
  let help = false
  const positional: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    const next = (): string => {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`harnessed: ${arg} needs a value`)
      index += 1
      return value
    }
    switch (arg) {
      case '--dry-run':
        dryRun = true
        break
      case '--overwrite-config':
        overwriteConfig = true
        break
      case '--components':
        layout.components = next()
        break
      case '--pages':
        layout.pages = next()
        break
      case '--harnesses':
        layout.harnesses = next()
        break
      case '--widget-harnesses':
        layout.widgetHarnesses = next()
        break
      case '--page-harnesses':
        layout.pageHarnesses = next()
        break
      case '--test-id-attr':
        layout.testIdAttribute = next()
        break
      case '--widget-testid':
        layout.widgetTestId = next()
        break
      case '--page-testid':
        layout.pageTestId = next()
        break
      case '--runners':
        layout.runners = parseRunners(next())
        break
      case '-h':
      case '--help':
        help = true
        break
      default:
        positional.push(arg)
    }
  }

  return { command: positional[0] ?? 'install', layout, dryRun, overwriteConfig, help }
}
