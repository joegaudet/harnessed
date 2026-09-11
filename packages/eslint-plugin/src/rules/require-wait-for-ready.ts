import type { Rule } from 'eslint'
import { dirOptionSchema, harnessDirsOf, inAnyDir, isAbstract, isPageHarness } from '../shared'

interface ClassBodyNode {
  body: Array<{
    type: string
    key?: { type: string; name?: string }
    value?: { body?: { body?: unknown[] } }
    abstract?: boolean
  }>
}

/**
 * `waitForReady()` is what stops a test racing the page. An empty one is worse
 * than none: it satisfies the abstract member and silently removes the wait, so
 * the failure lands somewhere unrelated later in the test.
 *
 * Only direct subclasses of the page base are checked. A concrete page that
 * extends an abstract page base inherits its wait, and TypeScript enforces the
 * abstract member on whichever class is concrete.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a non-empty waitForReady() on every PageHarness.',
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      missing: '{{name}} must implement waitForReady().',
      empty:
        "{{name}}'s waitForReady() is empty, which removes the wait it exists to provide. Wait for something the page actually renders.",
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}
    return {
      ClassDeclaration(node) {
        const asNode = node as unknown as Rule.Node
        if (!isPageHarness(asNode)) return

        const body = (node.body as unknown as ClassBodyNode).body
        const method = body.find(
          member =>
            member.type === 'MethodDefinition' &&
            member.key?.type === 'Identifier' &&
            member.key.name === 'waitForReady',
        )
        const name = node.id?.name ?? 'This page'

        if (method === undefined) {
          // An abstract base may leave the wait to its subclasses — but one it
          // does supply is inherited by every page built on it, so an empty one
          // there removes the wait from all of them and is still checked below.
          if (isAbstract(asNode)) return
          context.report({ node, messageId: 'missing', data: { name } })
          return
        }
        const statements = method.value?.body?.body ?? []
        if (statements.length === 0) {
          context.report({ node, messageId: 'empty', data: { name } })
        }
      },
    }
  },
}

export default rule
