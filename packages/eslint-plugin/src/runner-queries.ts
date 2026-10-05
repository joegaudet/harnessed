import type { Rule } from 'eslint'

/**
 * Raw DOM queries in each test runner's own API — the calls a harness exists
 * to replace. Shared by the rule that keeps them out of tests and the one that
 * keeps them out of harnesses.
 *
 * Every pattern is gated on where the name came from, so `find` from lodash or
 * `$` from jQuery is never mistaken for a runner's query.
 */
export interface RawQuery {
  /** What the runner's query is called on or imported from, for the message. */
  subject: string
  method: string
  /** How the call reads in source: `cy.get`, `find`, `browser.$`, `Selector`. */
  call: string
}

type Imports = Map<string, { source: string; imported: string }>

const CYPRESS_QUERIES = new Set(['get', 'contains', 'find'])
const EMBER_QUERIES = new Set(['find', 'findAll'])
/** test-helpers actions that also accept a selector string — the raw form. */
const EMBER_ACTIONS = new Set([
  'click',
  'doubleClick',
  'tap',
  'fillIn',
  'typeIn',
  'select',
  'focus',
  'blur',
  'triggerEvent',
  'triggerKeyEvent',
  'waitFor',
  'scrollTo',
])
const WDIO_SOURCES = new Set(['@wdio/globals', 'webdriverio'])

/** The file's imports, keyed by local name: `{ click as tap }` is `tap`. */
export function collectImports(program: Rule.Node): Imports {
  const imports: Imports = new Map()
  if (program.type !== 'Program') return imports
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue
    const source = String(statement.source.value)
    for (const specifier of statement.specifiers) {
      const imported =
        specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.type === 'ImportDefaultSpecifier'
            ? 'default'
            : '*'
      imports.set(specifier.local.name, { source, imported })
    }
  }
  return imports
}

/** Whether the file is a WebdriverIO test: it imports WDIO, or drives `browser`. */
function usesWebdriverio(imports: Imports, sourceText: string): boolean {
  for (const { source } of imports.values()) {
    if (WDIO_SOURCES.has(source) || source.startsWith('@wdio/')) return true
  }
  // The testrunner injects `browser` and `$` as globals, with no import.
  return /\bbrowser\.\w/.test(sourceText)
}

function isString(node: unknown): boolean {
  const n = node as { type?: string; value?: unknown } | undefined
  return (n?.type === 'Literal' && typeof n.value === 'string') || n?.type === 'TemplateLiteral'
}

/**
 * The runner query a call makes, if it is one. `sourceText` is the file's text,
 * used only to recognise WebdriverIO's injected globals.
 */
export function rawQueryOf(
  call: Rule.Node,
  imports: Imports,
  sourceText: string,
): RawQuery | undefined {
  if (call.type !== 'CallExpression') return undefined
  const { callee } = call
  const firstArg = call.arguments[0]

  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    const method = callee.property.name
    const object = callee.object

    // Cypress: cy.get('…'), cy.contains(…), cy.findByRole(…)
    if (object.type === 'Identifier' && object.name === 'cy') {
      if (CYPRESS_QUERIES.has(method) || /^find(All)?By/.test(method)) {
        return { subject: 'cy', method, call: `cy.${method}` }
      }
    }

    // WebdriverIO: browser.$('…'), browser.$$('…')
    if (
      object.type === 'Identifier' &&
      object.name === 'browser' &&
      (method === '$' || method === '$$')
    ) {
      return { subject: 'browser', method, call: `browser.${method}` }
    }

    // Ember: this.element.querySelector('…')
    if (
      (method === 'querySelector' || method === 'querySelectorAll') &&
      object.type === 'MemberExpression' &&
      object.object.type === 'ThisExpression' &&
      object.property.type === 'Identifier' &&
      object.property.name === 'element'
    ) {
      return { subject: 'this.element', method, call: `this.element.${method}` }
    }

    // qunit-dom: assert.dom('…') on a selector rather than an element
    if (
      object.type === 'Identifier' &&
      object.name === 'assert' &&
      method === 'dom' &&
      isString(firstArg)
    ) {
      return { subject: 'assert', method, call: `assert.${method}` }
    }
  }

  if (callee.type === 'Identifier') {
    const binding = imports.get(callee.name)

    // Ember: find / findAll, and actions handed a selector string.
    if (binding?.source === '@ember/test-helpers') {
      if (EMBER_QUERIES.has(binding.imported)) {
        return { subject: '@ember/test-helpers', method: binding.imported, call: callee.name }
      }
      if (EMBER_ACTIONS.has(binding.imported) && isString(firstArg)) {
        return { subject: '@ember/test-helpers', method: binding.imported, call: callee.name }
      }
    }

    // TestCafe: Selector('…')
    if (binding?.source === 'testcafe' && binding.imported === 'Selector') {
      return { subject: 'testcafe', method: 'Selector', call: callee.name }
    }

    // WebdriverIO: $('…') / $$('…'), imported or the testrunner's globals.
    if (callee.name === '$' || callee.name === '$$') {
      const fromWdio = binding !== undefined && WDIO_SOURCES.has(binding.source)
      const injected = binding === undefined && usesWebdriverio(imports, sourceText)
      if (fromWdio || injected)
        return { subject: 'webdriverio', method: callee.name, call: callee.name }
    }
  }

  return undefined
}
