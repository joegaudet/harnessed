import type { Rule } from 'eslint'
import {
  isDomQuery,
  isLocatorMethod,
  queryContextOf,
  rawDomHelperOf,
  rawQueryOf,
  type QueryContext,
} from '../runner-queries'
import {
  dirOptionSchema,
  harnessDirsOf,
  inAnyDir,
  isRunnerSupportFile,
  isStoriesFile,
  testDirsOf,
} from '../shared'

const SUBJECTS = new Set(['page', 'screen'])
/** In a stories file, the play context's `canvas` is Testing Library bound to the story. */
const STORY_SUBJECTS = new Set([...SUBJECTS, 'canvas'])

/**
 * A raw locator in a test re-couples that test to the DOM the harness exists to
 * hide, and the coupling is invisible until the markup changes and only that one
 * test breaks.
 *
 * A test constructs an env and its pages and harnesses, then calls only their
 * public methods, so it survives a new variant of the app with new harnesses
 * and no new tests.
 *
 * If the harness cannot answer the question, add a method to it.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow a runner's raw DOM queries and helpers in tests and Storybook play functions — Playwright, Testing Library, Puppeteer, Vitest browser, Cypress, Ember test-helpers, WebdriverIO, TestCafe, Storybook, the DOM — when a harness should be used.",
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      raw: 'Use a harness rather than `{{call}}(…)`. If the harness cannot answer this, add a public method to it.',
    },
  },
  create(context) {
    const stories = isStoriesFile(context.filename)
    if (!stories && !inAnyDir(context.filename, testDirsOf(context))) return {}
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
      // Every other runner: cy.get(…), find(…), $(…), Selector(…), within(…) and kin.
      CallExpression(node) {
        const call = node as unknown as Rule.Node
        const query =
          rawQueryOf(call, queries, sourceCode) ?? rawDomHelperOf(call, queries, sourceCode)
        if (query === undefined) return
        context.report({ node, messageId: 'raw', data: { call: query.call } })
      },
      // Playwright, Testing Library, Puppeteer and Vitest browser: page.… / screen.…
      // Then Testing Library's screen.* and fireEvent.*, and document's queries.
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return

        const subject =
          node.object.type === 'Identifier'
            ? node.object.name
            : node.object.type === 'MemberExpression' && node.object.property.type === 'Identifier'
              ? node.object.property.name
              : ''
        if (
          stories &&
          node.object.type === 'Identifier' &&
          node.object.name === 'canvasElement' &&
          isDomQuery(node.property.name)
        ) {
          context.report({
            node,
            messageId: 'raw',
            data: { call: `canvasElement.${node.property.name}` },
          })
          return
        }
        const subjects = stories ? STORY_SUBJECTS : SUBJECTS
        if (!subjects.has(subject) || !isLocatorMethod(node.property.name)) {
          const helper = rawDomHelperOf(node as unknown as Rule.Node, queries, sourceCode)
          if (helper !== undefined) {
            context.report({ node, messageId: 'raw', data: { call: helper.call } })
          }
          return
        }

        context.report({
          node,
          messageId: 'raw',
          // One line, however the chain was wrapped: `page\n  .getByRole` reads as `page.getByRole`.
          data: {
            call: sourceCode
              .getText(node)
              .replace(/\s*\n\s*/g, '')
              .replace(/\s+/g, ' '),
          },
        })
      },
    }
  },
}

export default rule
