import type { Rule } from 'eslint'

/**
 * TypeScript syntax nodes come from typescript-eslint's parser, so ESLint's own
 * node types do not describe them. This narrows what is read rather than asserting
 * the whole node away.
 */
type MaybeTsAs = Rule.Node & {
  expression?: { type?: string; typeAnnotation?: { type?: string } }
  typeAnnotation?: { type?: string }
  parent?: { type?: string; object?: unknown }
}

/**
 * `(harness as unknown as { page }).page` is the documented way around a
 * `protected` member, and it defeats the encapsulation deliberately. If a caller
 * needs something the harness does not expose, the fix is a public, behavioural
 * method on the harness.
 *
 * Three things have to be true before this fires, so that ordinary type work is
 * left alone:
 *
 * 1. a double cast through `unknown` — a single `as` is how you narrow a type;
 * 2. the asserted type is an inline object literal, i.e. a shape invented at the
 *    call site to name someone else's private member, rather than a real type;
 * 3. the result is immediately read from.
 *
 * `node as unknown as SomeNamedType` is how you bridge two type systems, and is
 * none of this rule's business.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow casting through `unknown` to reach a harness's protected members.",
      recommended: true,
    },
    schema: [],
    messages: {
      noCast:
        "Do not cast through `unknown` to reach a harness's internals. Add a public, behavioural method to the harness instead.",
    },
  },
  create(context) {
    return {
      TSAsExpression(node: Rule.Node) {
        const outer = node as MaybeTsAs
        const inner = outer.expression
        if (inner?.type !== 'TSAsExpression') return
        if (inner.typeAnnotation?.type !== 'TSUnknownKeyword') return
        // An invented shape, not a real type.
        if (outer.typeAnnotation?.type !== 'TSTypeLiteral') return
        // ...that is then read from.
        if (outer.parent?.type !== 'MemberExpression') return
        context.report({ node, messageId: 'noCast' })
      },
    }
  },
}

export default rule
