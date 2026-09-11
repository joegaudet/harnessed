import { loadConfigFor } from '@harnessed-ts/config'
import type { Rule } from 'eslint'

export interface HarnessRuleOptions {
  /** Directories treated as harness sources. Defaults to `['harness']`. */
  harnessDirs?: string[]
  /** Directories treated as test sources. Defaults to `['tests', 'e2e', '__tests__']`. */
  testDirs?: string[]
}

const DEFAULT_HARNESS_DIRS = ['harness']
const DEFAULT_TEST_DIRS = ['tests', 'e2e', '__tests__']

function normalise(filename: string): string {
  return filename.replaceAll('\\', '/')
}

export function inAnyDir(filename: string, dirs: string[]): boolean {
  const path = normalise(filename)
  return dirs.some(dir => path.includes(`/${dir}/`) || path.startsWith(`${dir}/`))
}

function dirsOf(
  context: Rule.RuleContext,
  key: keyof HarnessRuleOptions,
  fallback: string[],
): string[] {
  const options = (context.options[0] ?? {}) as HarnessRuleOptions
  return options[key] ?? fallback
}

/**
 * Where this repo keeps its harnesses.
 *
 * Rule options win, then `harnessed.config.ts`, then the default. Reading the
 * config is what stops a repo having to state its layout twice — once for the
 * linter and once for the docs generator — and then watching the two drift.
 */
export function harnessDirsOf(context: Rule.RuleContext): string[] {
  const explicit = (context.options[0] ?? {}) as HarnessRuleOptions
  if (explicit.harnessDirs !== undefined) return explicit.harnessDirs

  const configured = configuredHarnessDir(context)
  return configured === undefined ? DEFAULT_HARNESS_DIRS : [configured]
}

function configuredHarnessDir(context: Rule.RuleContext): string | undefined {
  try {
    // From the file, not the process cwd: a lint run started anywhere should
    // still find the config that governs the file it is checking.
    return loadConfigFor(context.filename)?.layout?.harnesses
  } catch {
    // A malformed config is the config's problem to report, not a reason for
    // every lint rule in the repo to crash.
    return undefined
  }
}

export function testDirsOf(context: Rule.RuleContext): string[] {
  return dirsOf(context, 'testDirs', DEFAULT_TEST_DIRS)
}

export const dirOptionSchema = {
  type: 'object' as const,
  properties: {
    harnessDirs: { type: 'array' as const, items: { type: 'string' as const } },
    testDirs: { type: 'array' as const, items: { type: 'string' as const } },
  },
  additionalProperties: false,
}

/** True when the node sits inside a method with the given name. */
export function insideMethodNamed(node: Rule.Node, name: string): boolean {
  let current: Rule.Node | null | undefined = node
  while (current) {
    if (
      (current.type === 'MethodDefinition' || current.type === 'PropertyDefinition') &&
      current.key?.type === 'Identifier' &&
      current.key.name === name
    ) {
      return true
    }
    current = current.parent as Rule.Node | null | undefined
  }
  return false
}

/**
 * The name of whatever a class extends, however it is written.
 *
 * Covers `extends X`, `extends ns.X`, and `extends X(Base)`. Written once because
 * two rules previously recognised different subsets, so `class R extends
 * ns.RouteHarness` was policed by one rule and silently skipped by the other.
 */
export function superClassName(node: Rule.Node): string | undefined {
  if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') return undefined
  const superClass = node.superClass
  if (superClass === null || superClass === undefined) return undefined
  if (superClass.type === 'Identifier') return superClass.name
  if (superClass.type === 'MemberExpression' && superClass.property.type === 'Identifier') {
    return superClass.property.name
  }
  if (superClass.type === 'CallExpression' && superClass.callee.type === 'Identifier') {
    return superClass.callee.name
  }
  return undefined
}

export function extendsHarnessBase(node: Rule.Node): boolean {
  const name = superClassName(node) ?? ''
  return name.endsWith('Harness') || name.endsWith('Page') || name.endsWith('Route')
}

/** `RouteHarness` is the deprecated name for `PageHarness`; both are pages. */
export function isPageHarness(node: Rule.Node): boolean {
  const name = superClassName(node)
  return name === 'PageHarness' || name === 'RouteHarness'
}

/**
 * The shapes a test file takes across runners: Vitest and Jest (`.test.`),
 * Playwright (`.spec.`), Cypress (`.cy.`), and Gherkin step definitions. Runtime
 * agnostic on purpose — a rule that knew one runner's AST would miss the others.
 */
export const DEFAULT_TEST_FILES = [
  '**/*.spec.*',
  '**/*.test.*',
  '**/*.cy.*',
  '**/*.steps.*',
  '**/steps/**',
]

/** Calls that put a component on screen inside the test itself. */
export const DEFAULT_RENDER_CALLEES = ['render', 'mount']

const globCache = new Map<string, RegExp>()

/**
 * A glob matcher small enough to own. `**` crosses directories, `*` and `?` do
 * not, `{a,b}` alternates over literal alternatives (no nesting, no wildcards
 * inside the braces). No dependency, because this plugin has none and a crash
 * here takes a consumer's whole build down. Memoised: it runs per file.
 */
function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob)
  if (cached !== undefined) return cached
  const compiled = compileGlob(glob)
  globCache.set(glob, compiled)
  return compiled
}

function compileGlob(glob: string): RegExp {
  let source = ''
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index]!
    if (char === '*') {
      if (glob[index + 1] === '*') {
        index += 1
        if (glob[index + 1] === '/') {
          index += 1
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
    } else if (char === '?') {
      source += '[^/]'
    } else if (char === '{') {
      const close = glob.indexOf('}', index)
      if (close === -1) {
        source += '\\{'
      } else {
        const alternatives = glob
          .slice(index + 1, close)
          .split(',')
          .map(alternative => alternative.replace(/[.+^$()|[\]\\]/g, '\\$&'))
        source += `(?:${alternatives.join('|')})`
        index = close
      }
    } else {
      source += char.replace(/[.+^$()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${source}$`)
}

/** True when the (normalised) filename matches any of the globs. */
export function matchesAnyGlob(filename: string, globs: string[]): boolean {
  const path = normalise(filename)
  const relative = path.replace(/^\/+/, '')
  return globs.some(glob => {
    const pattern = globToRegExp(glob)
    if (pattern.test(path) || pattern.test(relative)) return true
    // A glob with no leading `**/` still matches from any directory boundary.
    if (!glob.startsWith('**/') && !glob.startsWith('/')) {
      return globToRegExp(`**/${glob}`).test(path)
    }
    return false
  })
}

/**
 * What a `new X(...)` builds, judged by name. Pages are checked first because
 * `PageHarness` itself ends in `Harness`. A page named against convention —
 * `CheckoutPageHarness` — reads as a component; name pages `<Name>Page`.
 */
export function classifyConstructed(name: string): 'page' | 'component' | undefined {
  if (name === 'PageHarness' || name === 'RouteHarness') return 'page'
  if (name.endsWith('Page') || name.endsWith('Route')) return 'page'
  if (name.endsWith('Harness')) return 'component'
  return undefined
}

interface NamedExpression {
  type: string
  name?: string
  property?: { type: string; name?: string }
}

/** `X` for `new X()` / `x()`, or `X` for `new ns.X()` / `ns.x()`. */
export function expressionName(node: NamedExpression | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression' && node.property?.type === 'Identifier') {
    return node.property.name
  }
  return undefined
}

/** An abstract class may leave its host to subclasses. */
export function isAbstract(node: Rule.Node): boolean {
  return (node as Rule.Node & { abstract?: boolean }).abstract === true
}
