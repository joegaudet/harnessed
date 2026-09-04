#!/usr/bin/env node
import { relative } from 'node:path'
import { install } from './install'
import type { RenderContext } from './render'

const USAGE = `harnessed-claude — install the harness authoring skill and rules

Usage
  npx @harnessed/claude install [options]

Options
  --dry-run             Report what would change, write nothing
  --overwrite-config    Rewrite an existing harnessed.config.ts
  --components <dir>    Where reusable widgets live
  --screens <dir>       Where screens or pages live
  --harnesses <dir>     Where harnesses should be written
  --test-id-attr <str>  The test-id attribute in use (default: detected)
  --widget-testid <p>   Widget test-id pattern (default: ui-<kebab>)
  --screen-testid <p>   Screen test-id pattern (default: screen-<kebab>)
  -h, --help            Show this
`

function parse(argv: string[]): {
  command: string
  layout: Partial<RenderContext>
  dryRun: boolean
  overwriteConfig: boolean
  help: boolean
} {
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
      case '--screens':
        layout.screens = next()
        break
      case '--harnesses':
        layout.harnesses = next()
        break
      case '--test-id-attr':
        layout.testIdAttribute = next()
        break
      case '--widget-testid':
        layout.widgetTestId = next()
        break
      case '--screen-testid':
        layout.screenTestId = next()
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

function main(): void {
  const { command, layout, dryRun, overwriteConfig, help } = parse(process.argv.slice(2))

  if (help || command === 'help') {
    process.stdout.write(USAGE)
    return
  }
  if (command !== 'install') {
    process.stderr.write(`harnessed: unknown command "${command}".\n\n${USAGE}`)
    process.exitCode = 1
    return
  }

  const result = install({ layout, dryRun, overwriteConfig })
  const { context } = result

  process.stdout.write(
    [
      dryRun ? 'Would install (dry run):' : 'Installed:',
      ...result.written.map(path => `  ${relative(process.cwd(), path)}`),
      ...(result.skipped.length > 0
        ? [
            'Left alone (already present — pass --overwrite-config to replace):',
            ...result.skipped.map(path => `  ${relative(process.cwd(), path)}`),
          ]
        : []),
      '',
      'Layout used (override with the flags in --help if any of this is wrong):',
      `  components      ${context.components}`,
      `  screens         ${context.screens}`,
      `  harnesses       ${context.harnesses}`,
      `  test-id attr    ${context.testIdAttribute}`,
      `  widget test id  ${context.widgetTestId}`,
      `  screen test id  ${context.screenTestId}`,
      '',
    ].join('\n'),
  )
}

main()
