import type { Rule, Scope } from 'eslint'

/** The route builders a harnessed mock offers; `.reply()` ends their chain. */
const ROUTE_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'all',
  'route',
])
const GRAPHQL_METHODS = new Set(['query', 'mutation', 'operation'])
/** Methods on the mock itself that install before resolving. */
const INSTALLS = new Set(['use', 'useDefaults', 'useFor', 'useMsw', 'fromHar', 'ready'])
/** Calls that return a harnessed mock. */
const FACTORIES = new Set(['mock', 'typedApi'])

type Node = { type: string; parent?: Node; [key: string]: unknown }

function property(member: Node): string | undefined {
  const key = member['property'] as Node
  return key?.type === 'Identifier' ? (key['name'] as string) : undefined
}

function resolveInit(identifier: Node, scope: Scope.Scope): Node | undefined {
  const name = identifier['name'] as string
  let current: Scope.Scope | null = scope
  while (current !== null) {
    const variable = current.set.get(name)
    if (variable !== undefined) {
      const def = variable.defs[0]
      if (def?.type !== 'Variable') return undefined
      return (def.node as unknown as Node)['init'] as Node | undefined
    }
    current = current.upper
  }
  return undefined
}

/**
 * Whether `node` is a harnessed mock: a `mock(…)` or `typedApi(…)` call, a
 * variable initialised from one, or something named `mocks` — the fixture,
 * `world.mocks`, a play function's `context.mocks`.
 */
function isMock(node: Node | undefined, scope: Scope.Scope): boolean {
  if (node === undefined) return false
  if (node.type === 'AwaitExpression') return isMock(node['argument'] as Node, scope)
  if (node.type === 'CallExpression') {
    const callee = node['callee'] as Node
    return callee.type === 'Identifier' && FACTORIES.has(callee['name'] as string)
  }
  if (node.type === 'MemberExpression') return property(node) === 'mocks'
  if (node.type === 'Identifier') {
    if (node['name'] === 'mocks') return true
    return isMock(resolveInit(node, scope), scope)
  }
  return false
}

/** Walks `x.get(…).once().delay(…)` back to `x`, if the chain starts at a route method. */
function routeRoot(call: Node): Node | undefined {
  let current: Node | undefined = call
  while (current?.type === 'CallExpression') {
    const callee = current['callee'] as Node
    if (callee.type !== 'MemberExpression') return undefined
    const name = property(callee)
    const object = callee['object'] as Node
    if (name !== undefined && ROUTE_METHODS.has(name)) return object
    current = object
  }
  return undefined
}

/**
 * Registering a mock returns a promise that resolves once the runner is
 * intercepting. Left floating, a request fired straight after can go
 * unanswered — the flake this whole library exists to remove — and a rejection
 * (a runner that cannot mock, say) is never reported.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require awaiting `.reply()`, `.use()` and the other calls that install a harnessed mock, so the runner is intercepting before the page makes its requests.',
      recommended: true,
    },
    schema: [],
    messages: {
      floating:
        '`{{call}}` resolves once the runner is intercepting. Await it: otherwise a request fired straight after can go unanswered, and a failure to install goes unreported.',
    },
  },
  create(context) {
    return {
      ExpressionStatement(statement) {
        const expression = (statement as unknown as Node)['expression'] as Node
        if (expression.type !== 'CallExpression') return
        const callee = expression['callee'] as Node
        if (callee.type !== 'MemberExpression') return
        const name = property(callee)
        if (name === undefined) return
        const scope = context.sourceCode.getScope(statement)
        const object = callee['object'] as Node
        const graphql =
          GRAPHQL_METHODS.has(name) &&
          object.type === 'MemberExpression' &&
          property(object) === 'graphql' &&
          isMock(object['object'] as Node, scope)
        const floating =
          graphql ||
          (name === 'reply' && isMock(routeRoot(object), scope)) ||
          (INSTALLS.has(name) && isMock(object, scope))
        if (floating) {
          context.report({ node: statement, messageId: 'floating', data: { call: `.${name}()` } })
        }
      },
    }
  },
}

export default rule
