import type { Rule, Scope } from 'eslint'
import {
  dirOptionSchema,
  enclosingClass,
  harnessDirsOf,
  inAnyDir,
  isPageClass,
  isRunnerModule,
  moduleMatches,
} from '../shared'

interface Options {
  /** Module specifiers to accept anyway. A trailing `*` is a prefix: `'@scope/*'`. */
  allow?: string[]
}

/** `import x = require('…')`, which ESTree has no node for. */
interface ImportEquals {
  moduleReference: { type: string; expression?: { value?: unknown } }
}

/** Runner and DOM globals: Cypress, WebdriverIO, the DOM itself. */
const RUNNER_GLOBALS = new Set(['cy', 'browser', '$', '$$', 'document', 'window'])

/** Inside a page's own `waitForReady()` — the one place a harness may ask the driver. */
function insidePageWaitForReady(node: Rule.Node): boolean {
  let current: Rule.Node | null | undefined = node
  while (current) {
    if (
      (current.type === 'MethodDefinition' || current.type === 'PropertyDefinition') &&
      current.key?.type === 'Identifier' &&
      current.key.name === 'waitForReady'
    ) {
      const owner = enclosingClass(current)
      return owner !== undefined && isPageClass(owner)
    }
    current = current.parent as Rule.Node | null | undefined
  }
  return false
}

/**
 * A harness is the one place a test's vocabulary is translated into a driver's.
 * The moment it imports the driver, or a runner's DOM helper, that translation
 * leaks: the harness only works under that runner, and a new variant of the app
 * (a native build, say) needs its tests rewritten instead of its harnesses.
 *
 * A harness depends on `@harnessed-ts/core`, `@harnessed-ts/page`, other
 * harnesses, and the app's own types. The driver is picked by whoever builds the
 * env.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow test-runner, driver, and DOM imports and globals inside a harness; a harness speaks only in behaviours.',
      recommended: true,
    },
    schema: [
      {
        ...dirOptionSchema,
        properties: {
          ...dirOptionSchema.properties,
          allow: { type: 'array', items: { type: 'string' } },
        },
      },
    ],
    messages: {
      runnerImport:
        "A harness must not import from '{{source}}': that is a runner's or driver's vocabulary, and it ties every test behind this harness to it. Depend on @harnessed-ts/core and @harnessed-ts/page; whoever builds the env picks the driver.",
      runnerGlobal:
        "A harness must not use the `{{name}}` global: it is a runner's or the DOM's vocabulary. Use a decorated field, a @ChildHarness, or this.elementBy(selector). The only exception is a page's own waitForReady().",
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}
    const allow = ((context.options[0] ?? {}) as Options).allow ?? []

    function check(node: Rule.Node, source: unknown): void {
      if (typeof source !== 'string') return
      if (allow.some(pattern => moduleMatches(source, pattern))) return
      if (!isRunnerModule(source)) return
      context.report({ node, messageId: 'runnerImport', data: { source } })
    }

    function reportGlobal(node: Rule.Node, name: string): void {
      if (insidePageWaitForReady(node)) return
      context.report({ node, messageId: 'runnerGlobal', data: { name } })
    }

    /** `document` for `globalThis.document`; the same globals, one hop away. */
    function throughGlobalThis(
      reference: Scope.Reference,
    ): { node: Rule.Node; name: string } | undefined {
      const parent = (reference.identifier as Rule.Node).parent
      if (parent?.type !== 'MemberExpression' || parent.computed) return undefined
      if (parent.object !== reference.identifier) return undefined
      if (parent.property.type !== 'Identifier') return undefined
      const { name } = parent.property
      return RUNNER_GLOBALS.has(name) ? { node: parent.property as Rule.Node, name } : undefined
    }

    return {
      ImportDeclaration(node) {
        check(node as unknown as Rule.Node, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node as unknown as Rule.Node, node.source.value)
      },
      ExportAllDeclaration(node) {
        check(node as unknown as Rule.Node, node.source.value)
      },
      ImportExpression(node) {
        const source = node.source
        if (source.type === 'Literal') check(node as unknown as Rule.Node, source.value)
        // import(`playwright`): a template with nothing substituted is a literal.
        if (source.type === 'TemplateLiteral' && source.expressions.length === 0) {
          check(node as unknown as Rule.Node, source.quasis[0]?.value.cooked)
        }
      },
      // require('playwright'), as a bare call to the CommonJS global.
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return
        const [first] = node.arguments
        if (first?.type === 'Literal') check(node as unknown as Rule.Node, first.value)
      },
      // import pw = require('playwright'), which TypeScript keeps as its own node.
      TSImportEqualsDeclaration(node: Rule.Node) {
        const { moduleReference } = node as unknown as ImportEquals
        if (moduleReference.type === 'TSExternalModuleReference') {
          check(node, moduleReference.expression?.value)
        }
      },
      // Through scope analysis rather than by name, so a local `$` or a parameter
      // called `browser` is left alone. A global is either unresolved, or
      // resolved to a variable the config declared (`globals.browser`) with no
      // definition in the file.
      'Program:exit'(node) {
        const globalScope = context.sourceCode.getScope(node)
        const seen = new Set<unknown>()
        const watched = (name: string) => RUNNER_GLOBALS.has(name) || name === 'globalThis'
        const declared = globalScope.variables
          .filter(variable => variable.defs.length === 0 && watched(variable.name))
          .flatMap(variable => variable.references)
        for (const reference of [...globalScope.through, ...declared]) {
          const { identifier } = reference
          if (!watched(identifier.name) || seen.has(identifier)) continue
          seen.add(identifier)
          if (identifier.name === 'globalThis') {
            const property = throughGlobalThis(reference)
            if (property !== undefined) reportGlobal(property.node, property.name)
          } else {
            reportGlobal(identifier as Rule.Node, identifier.name)
          }
        }
      },
    }
  },
}

export default rule
