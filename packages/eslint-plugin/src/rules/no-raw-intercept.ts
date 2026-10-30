import type { Rule } from 'eslint'
import {
  dirOptionSchema,
  harnessDirsOf,
  inAnyDir,
  isRunnerSupportFile,
  isStoriesFile,
  testDirsOf,
} from '../shared'

/** Playwright's network routing, on a page or a browser context. */
const PLAYWRIGHT_ROUTES = new Set(['route', 'routeWebSocket', 'routeFromHAR'])
const PLAYWRIGHT_SUBJECTS = new Set(['page', 'context'])
/** Called bare: TestCafe's mock, MSW's server and worker. */
const BARE_CALLS = new Set(['RequestMock', 'setupServer', 'setupWorker'])

type Node = Rule.Node & { type: string; [key: string]: unknown }

function nameOf(node: unknown): string | undefined {
  const value = node as {
    type?: string
    name?: string
    property?: { type?: string; name?: string }
  }
  if (value?.type === 'Identifier') return value.name
  if (value?.type === 'MemberExpression' && value.property?.type === 'Identifier')
    return value.property.name
  return undefined
}

/** The runner hook a call reaches for, named as the message shows it, or `undefined`. */
function rawInterceptOf(node: Node): string | undefined {
  const callee = node['callee'] as Node
  if (callee.type === 'Identifier') {
    const name = callee['name'] as string
    return BARE_CALLS.has(name) ? name : undefined
  }
  if (callee.type !== 'MemberExpression') return undefined
  const method = nameOf({ type: 'MemberExpression', property: callee['property'] })
  const subject = nameOf(callee['object'])
  if (method === undefined || subject === undefined) return undefined
  if (PLAYWRIGHT_ROUTES.has(method) && PLAYWRIGHT_SUBJECTS.has(subject))
    return `${subject}.${method}`
  if (method === 'intercept' && subject === 'cy') return 'cy.intercept'
  if (method === 'setRequestInterception') return `${subject}.setRequestInterception`
  // WebdriverIO's; `cy.mock` is harnessed's own command.
  if (method === 'mock' && subject === 'browser') return 'browser.mock'
  return undefined
}

/**
 * A runner's own interception in a test ties that test's backend to one runner:
 * the same mocks have to be written again for the next one, and they drift.
 * `mock(env)` from `@harnessed-ts/mock` runs the same handlers under every
 * runner, and imports MSW handlers too.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow a runner's own request interception in tests — Playwright's page.route, cy.intercept, Puppeteer's request interception, WebdriverIO's browser.mock, TestCafe's RequestMock, MSW's setupServer — when `mock(env)` should be used.",
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      raw: 'Mock through `mock(env)` from @harnessed-ts/mock rather than `{{call}}(…)`: the same handlers then run under every runner. MSW handlers go through `api.useMsw(handlers)`.',
    },
  },
  create(context) {
    const stories = isStoriesFile(context.filename)
    if (!stories && !inAnyDir(context.filename, testDirsOf(context))) return {}
    if (inAnyDir(context.filename, harnessDirsOf(context))) return {}
    if (isRunnerSupportFile(context.filename)) return {}
    return {
      CallExpression(node) {
        const call = rawInterceptOf(node as unknown as Node)
        if (call !== undefined) context.report({ node, messageId: 'raw', data: { call } })
      },
    }
  },
}

export default rule
