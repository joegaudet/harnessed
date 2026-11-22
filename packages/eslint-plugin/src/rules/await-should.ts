import type { Rule } from 'eslint'

type Node = { type: string; [key: string]: unknown }

function property(member: Node): string | undefined {
  const key = member['property'] as Node
  return key?.type === 'Identifier' ? (key['name'] as string) : undefined
}

/**
 * Whether a call's callee chain passes through `.should.` — a `should` that is
 * itself chained on, as `@harnessed-ts/should` is. Cypress's `.should('…')` is
 * called, never chained on, so it is left alone.
 */
function throughShould(callee: Node): boolean {
  let current: Node | undefined = callee
  while (current !== undefined) {
    if (current.type === 'MemberExpression') {
      const object = current['object'] as Node
      if (object.type === 'MemberExpression' && property(object) === 'should') return true
      current = object
    } else if (current.type === 'CallExpression') {
      current = current['callee'] as Node
    } else {
      return false
    }
  }
  return false
}

/**
 * Every `@harnessed-ts/should` terminal returns a promise: reading the page goes
 * through a driver. Left floating, the assertion cannot fail the test — it fails
 * after the test has passed, or not at all. `no-floating-promises` catches this
 * with type information; this rule catches it without.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require awaiting a `.should` assertion from @harnessed-ts/should, so its failure fails the test.',
      recommended: true,
    },
    schema: [],
    messages: {
      floating:
        '`{{call}}` on a `.should` chain returns a promise. Await it: an un-awaited assertion cannot fail the test.',
    },
  },
  create(context) {
    return {
      ExpressionStatement(statement) {
        const expression = (statement as unknown as Node)['expression'] as Node
        if (expression.type !== 'CallExpression') return
        const callee = expression['callee'] as Node
        if (callee.type !== 'MemberExpression' || !throughShould(callee)) return
        context.report({
          node: statement,
          messageId: 'floating',
          data: { call: `.${property(callee) ?? 'call'}()` },
        })
      },
    }
  },
}

export default rule
