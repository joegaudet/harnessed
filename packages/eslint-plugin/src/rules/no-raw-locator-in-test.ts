import type { Rule } from 'eslint'
import { dirOptionSchema, inAnyDir, testDirsOf } from '../shared'

const LOCATOR_METHODS = new Set([
  'getByRole',
  'getByTestId',
  'getByLabel',
  'getByLabelText',
  'getByText',
  'getByPlaceholder',
  'getByPlaceholderText',
  'findByRole',
  'findByTestId',
  'findByLabelText',
  'findByText',
  'findByPlaceholderText',
  'queryByRole',
  'queryByTestId',
  'queryByText',
  'locator',
])

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
      description: 'Disallow raw page/screen locators in tests when a harness should be used.',
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      raw: 'Use a harness rather than `{{subject}}.{{method}}(…)`. If the harness cannot answer this, add a public method to it.',
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, testDirsOf(context))) return {}
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return
        if (!LOCATOR_METHODS.has(node.property.name)) return

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
          data: { subject, method: node.property.name },
        })
      },
    }
  },
}

export default rule
