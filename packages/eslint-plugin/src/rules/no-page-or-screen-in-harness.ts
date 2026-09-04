import type { Rule } from 'eslint'
import { dirOptionSchema, harnessDirsOf, inAnyDir, insideMethodNamed } from '../shared'

/**
 * A harness that reaches for the driver's own query API has stopped being an
 * abstraction: the scope chain is dropped, and the coupling it exists to contain
 * leaks straight back into the tests.
 *
 * The one legitimate exception is a RouteHarness's own `waitForReady()`, which has
 * to talk to the page to know the URL has arrived.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `page` and `screen` inside a harness; use a decorated field, a child harness, or elementBy().',
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      noPage:
        "A harness must not use `{{name}}`. Add a decorated field, a @ChildHarness, or use this.elementBy(selector) for a selector computed at call time. The only exception is a RouteHarness's own waitForReady().",
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}

    function report(node: Rule.Node, name: string): void {
      if (insideMethodNamed(node, 'waitForReady')) return
      context.report({ node, messageId: 'noPage', data: { name } })
    }

    return {
      // this.page.…
      MemberExpression(node) {
        const asNode = node as unknown as Rule.Node & typeof node
        if (
          node.object.type === 'ThisExpression' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'page'
        ) {
          report(asNode, 'this.page')
        }
      },
      // bare `screen.…` from the testing-library global
      Identifier(node) {
        if (node.name !== 'screen') return
        const parent = (node as unknown as Rule.Node).parent
        if (parent?.type === 'MemberExpression' && parent.object === node) {
          report(node as unknown as Rule.Node, 'screen')
        }
      },
    }
  },
}

export default rule
