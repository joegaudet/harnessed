import type { Rule } from 'eslint'
import { dirOptionSchema, extendsHarnessBase, harnessDirsOf, inAnyDir, isAbstract } from '../shared'

function hasHarnessDecorator(node: Rule.Node): boolean {
  const decorators = (node as Rule.Node & { decorators?: unknown[] }).decorators ?? []
  return decorators.some(decorator => {
    const expression = (decorator as { expression?: { callee?: { name?: string } } }).expression
    return expression?.callee?.name === 'Harness'
  })
}

/**
 * A harness with no host is only caught when it is constructed, which in practice
 * means a failure in whichever test happened to run first, pointing at the test
 * rather than the harness.
 *
 * An abstract class is exempt: leaving the host to each subclass is the supported
 * way to share a shape between screens.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require @Harness({ host }) on every concrete harness class.',
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      missing:
        "{{name}} has no host. Add @Harness({ host: testId('…') }) — anchored on a test id, never on copy.",
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}
    return {
      ClassDeclaration(node) {
        const asNode = node as unknown as Rule.Node
        if (!extendsHarnessBase(asNode)) return
        if (isAbstract(asNode)) return
        if (hasHarnessDecorator(asNode)) return
        context.report({
          node,
          messageId: 'missing',
          data: { name: node.id?.name ?? 'This harness' },
        })
      },
    }
  },
}

export default rule
