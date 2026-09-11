import type { Rule } from 'eslint'
import {
  classifyConstructed,
  DEFAULT_RENDER_CALLEES,
  DEFAULT_TEST_FILES,
  expressionName,
  matchesAnyGlob,
} from '../shared'

interface Options {
  /** Globs naming test files. Defaults cover Playwright, Vitest/Jest, Cypress, and step files. */
  testFiles?: string[]
  /** Calls that put a component on screen inside the test. Defaults to `render` and `mount`. */
  renderCallees?: string[]
}

/**
 * A test that constructs a component harness directly has skipped the page it
 * belongs to, so the scope the page provides is gone and the test is coupled to
 * one component in isolation — the exact thing that breaks when a screen is
 * rearranged. Enter through a page and reach the component from there.
 *
 * The exemption is a test that renders the component itself: a unit test has no
 * page, only the component it just mounted. The check is file-scoped, because a
 * render call anywhere in the file is evidence of that kind of test.
 *
 * Runtime agnostic by design: files are matched by glob, and a component harness
 * is recognised by name. `**\/steps/**` catches Gherkin step definitions under any
 * runner and may also match a non-test directory called `steps`; narrow
 * `testFiles` if that bites.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require tests to enter through a page rather than construct a component harness directly.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          testFiles: { type: 'array', items: { type: 'string' } },
          renderCallees: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      enterThroughPage:
        '{{name}} is a component harness. A test enters through a page: construct a Page (extends PageHarness) and reach {{name}} through it. A test that renders the component itself (render()/mount()) may construct it directly.',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options
    const testFiles = options.testFiles ?? DEFAULT_TEST_FILES
    const renderCallees = new Set(options.renderCallees ?? DEFAULT_RENDER_CALLEES)
    if (!matchesAnyGlob(context.filename, testFiles)) return {}

    let rendersInFile = false
    const constructed: Array<{ node: Rule.Node; name: string }> = []

    return {
      CallExpression(node) {
        const name = expressionName(node.callee)
        if (name !== undefined && renderCallees.has(name)) rendersInFile = true
      },
      NewExpression(node) {
        const name = expressionName(node.callee)
        if (name === undefined) return
        if (classifyConstructed(name) !== 'component') return
        constructed.push({ node: node as unknown as Rule.Node, name })
      },
      // Deferred so a render call after the construction still exempts the file.
      'Program:exit'() {
        if (rendersInFile) return
        for (const { node, name } of constructed) {
          context.report({ node, messageId: 'enterThroughPage', data: { name } })
        }
      },
    }
  },
}

export default rule
