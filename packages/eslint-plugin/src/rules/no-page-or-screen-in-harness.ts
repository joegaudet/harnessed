import type { Rule } from 'eslint'
import { isLocatorMethod, queryContextOf, rawQueryOf, type QueryContext } from '../runner-queries'
import { dirOptionSchema, harnessDirsOf, inAnyDir, insideMethodNamed } from '../shared'

/**
 * A harness that reaches for the driver's own query API has stopped being an
 * abstraction: the scope chain is dropped, and the coupling it exists to contain
 * leaks straight back into the tests.
 *
 * The one legitimate exception is a PageHarness's own `waitForReady()`, which may
 * have to talk to the driver to know the page has arrived.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow `this.page`, a bare `page`'s queries, `screen`, and any runner's own DOM queries (cy.get, find, $, Selector…) inside a harness; use a decorated field, a child harness, or elementBy().",
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      noPage:
        "A harness must not use `{{name}}`. Add a decorated field, a @ChildHarness, or use this.elementBy(selector) for a selector computed at call time. The only exception is a PageHarness's own waitForReady().",
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}

    function report(node: Rule.Node, name: string): void {
      if (insideMethodNamed(node, 'waitForReady')) return
      context.report({ node, messageId: 'noPage', data: { name } })
    }

    const { sourceCode } = context
    let queries: QueryContext = { imports: new Map(), wdioGlobals: false }

    return {
      Program(node) {
        queries = queryContextOf(node as unknown as Rule.Node, sourceCode)
      },
      // A runner's own query: cy.get(…), find(…), browser.$(…), Selector(…).
      CallExpression(node) {
        const query = rawQueryOf(node as unknown as Rule.Node, queries, sourceCode)
        if (query === undefined) return
        report(node as unknown as Rule.Node, query.call)
      },
      // this.page.…, and a bare page's queries: Vitest browser's imported
      // `page`, jest-puppeteer's global one, page.getByRole / page.$ / …
      MemberExpression(node) {
        const asNode = node as unknown as Rule.Node & typeof node
        if (node.property.type !== 'Identifier') return
        if (node.object.type === 'ThisExpression' && node.property.name === 'page') {
          report(asNode, 'this.page')
        } else if (
          node.object.type === 'Identifier' &&
          node.object.name === 'page' &&
          isLocatorMethod(node.property.name)
        ) {
          report(asNode, `page.${node.property.name}`)
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
