import type { Rule } from 'eslint'
import { isLocatorMethod, queryContextOf, rawQueryOf, type QueryContext } from '../runner-queries'
import {
  dirOptionSchema,
  harnessDirsOf,
  inAnyDir,
  isRunnerSupportFile,
  testDirsOf,
} from '../shared'

const SUBJECTS = new Set(['page', 'screen'])

/**
 * A raw locator in a test re-couples that test to the DOM the harness exists to
 * hide, and the coupling is invisible until the markup changes and only that one
 * test breaks.
 *
 * If the harness cannot answer the question, add a method to it.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow a runner's raw DOM queries in tests — Playwright, Testing Library, Puppeteer, Vitest browser, Cypress, Ember test-helpers, WebdriverIO, TestCafe — when a harness should be used.",
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      raw: 'Use a harness rather than `{{call}}(…)`. If the harness cannot answer this, add a public method to it.',
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, testDirsOf(context))) return {}
    // A harness under `tests/harness/` is the harness rule's to police, and its
    // waitForReady() may legitimately wait on the DOM.
    if (inAnyDir(context.filename, harnessDirsOf(context))) return {}
    if (isRunnerSupportFile(context.filename)) return {}
    const { sourceCode } = context
    let queries: QueryContext = { imports: new Map(), wdioGlobals: false }
    return {
      Program(node) {
        queries = queryContextOf(node as unknown as Rule.Node, sourceCode)
      },
      // Every other runner: cy.get(…), find(…), $(…), Selector(…) and kin.
      CallExpression(node) {
        const query = rawQueryOf(node as unknown as Rule.Node, queries, sourceCode)
        if (query === undefined) return
        context.report({ node, messageId: 'raw', data: { call: query.call } })
      },
      // Playwright, Testing Library, Puppeteer and Vitest browser: page.… / screen.…
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return
        if (!isLocatorMethod(node.property.name)) return

        const subject =
          node.object.type === 'Identifier'
            ? node.object.name
            : node.object.type === 'MemberExpression' && node.object.property.type === 'Identifier'
              ? node.object.property.name
              : ''
        if (!SUBJECTS.has(subject)) return

        context.report({
          node,
          messageId: 'raw',
          data: { call: sourceCode.getText(node) },
        })
      },
    }
  },
}

export default rule
