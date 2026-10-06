#!/usr/bin/env node
import { relative } from 'node:path'
import { parseArgs, USAGE } from './args'
import { install } from './install'

function main(): void {
  const { command, layout, dryRun, overwriteConfig, help } = parseArgs(process.argv.slice(2))

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
      ...(result.removed.length > 0
        ? [
            dryRun
              ? 'Would remove (superseded or no longer used):'
              : 'Removed (superseded or no longer used):',
            ...result.removed.map(path => `  ${relative(process.cwd(), path)}`),
          ]
        : []),
      ...(result.skipped.length > 0
        ? [
            'Left alone (already present — pass --overwrite-config to replace):',
            ...result.skipped.map(path => `  ${relative(process.cwd(), path)}`),
          ]
        : []),
      '',
      result.usedExistingConfig
        ? 'Layout used (from harnessed.config.ts, with detection filling any gaps):'
        : 'Layout used (detected \u2014 override with the flags in --help if any is wrong):',
      `  components      ${context.components}`,
      `  pages           ${context.pages}`,
      `  harnesses       ${context.harnesses}`,
      `  widget harness  ${context.widgetHarnesses}`,
      `  page harness    ${context.pageHarnesses}`,
      `  test-id attr    ${context.testIdAttribute}`,
      `  widget test id  ${context.widgetTestId}`,
      `  page test id    ${context.pageTestId}`,
      `  runners         ${result.runners.length > 0 ? result.runners.join(', ') : 'none detected'}`,
      '',
    ].join('\n'),
  )
}

try {
  main()
} catch (error) {
  // A bad flag or an unknown runner: say what, not a stack trace.
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
