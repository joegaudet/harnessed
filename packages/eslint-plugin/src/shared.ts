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

export function harnessDirsOf(context: Rule.RuleContext): string[] {
  const options = (context.options[0] ?? {}) as HarnessRuleOptions
  return options.harnessDirs ?? DEFAULT_HARNESS_DIRS
}

export function testDirsOf(context: Rule.RuleContext): string[] {
  const options = (context.options[0] ?? {}) as HarnessRuleOptions
  return options.testDirs ?? DEFAULT_TEST_DIRS
}

export const dirOptionSchema = {
  type: 'object' as const,
  properties: {
    harnessDirs: { type: 'array' as const, items: { type: 'string' as const } },
    testDirs: { type: 'array' as const, items: { type: 'string' as const } },
  },
  additionalProperties: false,
}

/**
 * Walks to the nearest enclosing class, if any.
 *
 * `parent` is `null` at the Program root, not `undefined` — a loop that only
 * checks for `undefined` walks off the top of the tree and crashes the whole lint
 * run on the file.
 */
export function enclosingClass(node: Rule.Node): Rule.Node | undefined {
  let current: Rule.Node | null | undefined = node
  while (current) {
    if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') return current
    current = current.parent as Rule.Node | null | undefined
  }
  return undefined
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

export function extendsHarnessBase(node: Rule.Node): boolean {
  if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') return false
  const superClass = node.superClass
  if (superClass === null || superClass === undefined) return false
  const name =
    superClass.type === 'Identifier'
      ? superClass.name
      : superClass.type === 'MemberExpression' && superClass.property.type === 'Identifier'
        ? superClass.property.name
        : ''
  return name.endsWith('Harness') || name.endsWith('Route')
}
