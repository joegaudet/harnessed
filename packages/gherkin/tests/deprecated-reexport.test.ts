import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// The re-export @harnessed-ts/playwright keeps for one release. A consumer's
// editor should strike through every name it imports from there, so this asks
// the TypeScript language service, the thing an editor asks, what it reports.
const reexport = fileURLToPath(new URL('../../playwright/src/bdd.ts', import.meta.url))
const consumer = fileURLToPath(new URL('../../playwright/src/__consumer__.ts', import.meta.url))
const consumerSource = `
import { withWorld } from './bdd'
import type { WithWorld, WorldFixture } from './bdd'
export const extend = withWorld
export type Extended = WithWorld<unknown, unknown>
export type Fixture = WorldFixture<unknown>
`

function deprecatedNames(): string[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    types: [],
  }
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [consumer, reexport],
    getScriptVersion: () => '1',
    getScriptSnapshot: fileName => {
      const text = fileName === consumer ? consumerSource : ts.sys.readFile(fileName)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: fileName => fileName === consumer || ts.sys.fileExists(fileName),
    readFile: fileName => (fileName === consumer ? consumerSource : ts.sys.readFile(fileName)),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  }
  const service = ts.createLanguageService(host)
  const errors = service.getSemanticDiagnostics(consumer)
  if (errors.length > 0) {
    throw new Error(
      errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'),
    )
  }
  return service
    .getSuggestionDiagnostics(consumer)
    .filter(diagnostic => diagnostic.reportsDeprecated)
    .map(diagnostic => consumerSource.slice(diagnostic.start, diagnostic.start + diagnostic.length))
}

describe('@harnessed-ts/playwright/bdd', () => {
  it('marks every name it re-exports deprecated', () => {
    expect(new Set(deprecatedNames())).toEqual(new Set(['withWorld', 'WithWorld', 'WorldFixture']))
  })
})
