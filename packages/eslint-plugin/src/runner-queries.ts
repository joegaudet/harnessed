import type { Rule, Scope, SourceCode } from 'eslint'

/**
 * Raw DOM queries in each test runner's own API — the calls a harness exists
 * to replace. Shared by the rule that keeps them out of tests and the one that
 * keeps them out of harnesses.
 *
 * Every bare-function pattern is gated on where the name came from, so `find`
 * from lodash or `$` from jQuery is never mistaken for a runner's query.
 */
export interface RawQuery {
  /** What the runner's query is called on or imported from. */
  subject: string
  method: string
  /** How the call reads in source, for the message: `cy.get`, `find`, `w$`, `Selector`. */
  call: string
}

type Imports = Map<string, { source: string; imported: string }>

/** What a file's queries are judged against, worked out once per file. */
export interface QueryContext {
  imports: Imports
  /** Whether a bare, undeclared `$` / `$$` is WebdriverIO's injected global. */
  wdioGlobals: boolean
}

/**
 * The query methods on Playwright's and Vitest browser's `page`, Testing
 * Library's `screen`, and Puppeteer's `page`: every `getBy*` / `queryAllBy*` /
 * `findAllBy*` variant, plus the CSS-selector ones.
 */
const SELECTOR_METHODS = new Set(['locator', '$', '$$', '$eval', '$$eval', 'waitForSelector'])

export function isLocatorMethod(name: string): boolean {
  return /^(get|query|find)(All)?By[A-Z]/.test(name) || SELECTOR_METHODS.has(name)
}

// `cy.find` is not a parent command — `.find` only chains off a subject.
// `cy.xpath` is the cypress-xpath plugin's.
const CYPRESS_QUERIES = new Set(['get', 'contains', 'xpath'])
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
const WDIO_QUERIES = new Set(['$', '$$'])
const PUPPETEER_SOURCES = new Set(['puppeteer', 'puppeteer-core', 'jest-puppeteer'])

/** The file's imports, keyed by local name: `{ click as tap }` is `tap`. */
function collectImports(program: Rule.Node): Imports {
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

/**
 * References to `name` as a global the file never declares: unresolved, or
 * resolved to a global from the lint config (which has no definition).
 */
export function globalReferences(globalScope: Scope.Scope, name: string): Scope.Reference[] {
  const declared = globalScope.set.get(name)
  if (declared !== undefined) return declared.defs.length === 0 ? declared.references : []
  return globalScope.through.filter(reference => reference.identifier.name === name)
}

/** `browser.url(…)`, not `browser` alone or a mention in a comment. */
function usedAsObject(reference: Scope.Reference): boolean {
  const identifier = reference.identifier as unknown as Rule.Node
  const parent = identifier.parent
  return parent?.type === 'MemberExpression' && parent.object === identifier
}

/**
 * Whether the testrunner's injected `$` / `$$` are in play: the file imports
 * WDIO, or drives the undeclared `browser` global — unless it is a Puppeteer
 * file, whose `browser` (and jest-puppeteer's `page`) are something else.
 */
function usesWdioGlobals(imports: Imports, globalScope: Scope.Scope): boolean {
  const sources = [...imports.values()].map(({ source }) => source)
  if (sources.some(source => WDIO_SOURCES.has(source) || source.startsWith('@wdio/'))) return true
  if (sources.some(source => PUPPETEER_SOURCES.has(source))) return false
  if (globalReferences(globalScope, 'page').length > 0) return false
  return globalReferences(globalScope, 'browser').some(usedAsObject)
}

/** Work out, once per file, what its queries are judged against. */
export function queryContextOf(program: Rule.Node, sourceCode: SourceCode): QueryContext {
  const imports = collectImports(program)
  return { imports, wdioGlobals: usesWdioGlobals(imports, sourceCode.getScope(program)) }
}

function isString(node: unknown): boolean {
  const n = node as { type?: string; value?: unknown } | undefined
  return (n?.type === 'Literal' && typeof n.value === 'string') || n?.type === 'TemplateLiteral'
}

/** `cy.get('@order')`, or `` cy.get(`@${name}`) ``, reads an alias, not the DOM. */
function isAlias(node: unknown): boolean {
  const n = node as
    { type?: string; value?: unknown; quasis?: { value: { cooked?: string | null } }[] } | undefined
  if (n?.type === 'Literal') return typeof n.value === 'string' && n.value.startsWith('@')
  if (n?.type === 'TemplateLiteral') return n.quasis?.[0]?.value.cooked?.startsWith('@') === true
  return false
}

function variableNamed(scope: Scope.Scope | null, name: string): Scope.Variable | undefined {
  for (let current = scope; current !== null; current = current.upper) {
    const variable = current.set.get(name)
    if (variable !== undefined) return variable
  }
  return undefined
}

/**
 * What a variable was bound to, when it is destructured from a CommonJS
 * `require` of a WebdriverIO module: `const { $, $$: all } = require('@wdio/globals')`
 * binds `all` to `$$`, read like the import it stands for.
 */
function requiredBinding(
  variable: Scope.Variable | undefined,
): { source: string; imported: string } | undefined {
  if (variable === undefined) return undefined
  const def = variable.defs[0]
  if (def?.type !== 'Variable') return undefined
  const { id, init } = def.node
  if (id.type !== 'ObjectPattern' || init?.type !== 'CallExpression') return undefined
  if (init.callee.type !== 'Identifier' || init.callee.name !== 'require') return undefined
  const [source] = init.arguments
  if (source?.type !== 'Literal' || typeof source.value !== 'string') return undefined
  if (!WDIO_SOURCES.has(source.value)) return undefined
  for (const property of id.properties) {
    if (property.type !== 'Property' || property.computed) continue
    if (property.value.type !== 'Identifier' || property.value.name !== variable.name) continue
    const { key } = property
    const imported =
      key.type === 'Identifier' ? key.name : key.type === 'Literal' ? String(key.value) : undefined
    return imported === undefined ? undefined : { source: source.value, imported }
  }
  return undefined
}

/** The runner query a call makes, if it is one. */
export function rawQueryOf(
  call: Rule.Node,
  context: QueryContext,
  sourceCode: SourceCode,
): RawQuery | undefined {
  if (call.type !== 'CallExpression') return undefined
  const { callee } = call
  const firstArg = call.arguments[0]

  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    const method = callee.property.name
    const object = callee.object

    // Cypress: cy.get('…'), cy.contains(…), cy.findByRole(…)
    if (object.type === 'Identifier' && object.name === 'cy') {
      if (method === 'get' && isAlias(firstArg)) return undefined
      if (CYPRESS_QUERIES.has(method) || /^find(All)?By/.test(method)) {
        return { subject: 'cy', method, call: `cy.${method}` }
      }
    }

    // WebdriverIO: browser.$('…'), browser.$$('…')
    if (object.type === 'Identifier' && object.name === 'browser' && WDIO_QUERIES.has(method)) {
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
    // Resolved through scope, so a local `find` or `$` shadowing an import or
    // a global is left alone.
    const variable = variableNamed(sourceCode.getScope(call), callee.name)
    const imported = variable?.defs[0]?.type === 'ImportBinding'
    const binding = imported ? context.imports.get(callee.name) : requiredBinding(variable)

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

    // WebdriverIO: $('…') / $$('…'), imported (under any name)…
    if (binding !== undefined && WDIO_SOURCES.has(binding.source)) {
      if (WDIO_QUERIES.has(binding.imported)) {
        return { subject: binding.source, method: binding.imported, call: callee.name }
      }
    }

    // …or the testrunner's globals, which the file never declares.
    const undeclared = variable === undefined || variable.defs.length === 0
    if (undeclared && WDIO_QUERIES.has(callee.name) && context.wdioGlobals) {
      return { subject: 'webdriverio', method: callee.name, call: callee.name }
    }
  }

  return undefined
}

const TESTING_LIBRARY = '@testing-library/'

/** Testing Library's DOM helpers a test may reach for: every member of each is raw. */
const TESTING_LIBRARY_OBJECTS = new Set(['screen', 'fireEvent'])

/** The DOM's own queries on the global `document`. */
const DOCUMENT_QUERIES = new Set([
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'getElementsByClassName',
  'getElementsByName',
  'getElementsByTagName',
])

/**
 * What a bare name stands for: itself when it is a global the file never
 * declares, the imported name when it comes from Testing Library (`within as
 * w` is `within`), and undefined for anything else — a local, or an import from
 * elsewhere.
 */
function testingLibraryName(
  identifier: Rule.Node & { name: string },
  context: QueryContext,
  sourceCode: SourceCode,
): string | undefined {
  const variable = variableNamed(sourceCode.getScope(identifier), identifier.name)
  if (variable === undefined || variable.defs.length === 0) return identifier.name
  if (variable.defs[0]?.type !== 'ImportBinding') return undefined
  const binding = context.imports.get(identifier.name)
  return binding?.source.startsWith(TESTING_LIBRARY) === true ? binding.imported : undefined
}

function isGlobal(identifier: Rule.Node & { name: string }, sourceCode: SourceCode): boolean {
  const variable = variableNamed(sourceCode.getScope(identifier), identifier.name)
  return variable === undefined || variable.defs.length === 0
}

/**
 * The DOM helpers a test reaches for when it has no harness to ask, beyond the
 * queries `rawQueryOf` knows: any member of Testing Library's `screen` (its
 * `debug()` reads markup too) or `fireEvent`, its `within(…)`, and the global
 * `document`'s own queries. Resolved through scope, so a test that calls its
 * page `screen`, or parses a `document` of its own, is left alone.
 *
 * Test-side only. Inside a harness, the harness rules already refuse every
 * Testing Library import and the `document` global.
 */
export function rawDomHelperOf(
  node: Rule.Node,
  context: QueryContext,
  sourceCode: SourceCode,
): RawQuery | undefined {
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
    const callee = node.callee as Rule.Node & { name: string }
    if (testingLibraryName(callee, context, sourceCode) !== 'within') return undefined
    return { subject: '@testing-library', method: 'within', call: callee.name }
  }

  if (node.type !== 'MemberExpression' || node.computed) return undefined
  if (node.object.type !== 'Identifier' || node.property.type !== 'Identifier') return undefined
  const object = node.object as Rule.Node & { name: string }
  const method = node.property.name
  const call = `${object.name}.${method}`

  const helper = testingLibraryName(object, context, sourceCode)
  if (helper !== undefined && TESTING_LIBRARY_OBJECTS.has(helper)) {
    return { subject: helper, method, call }
  }
  if (object.name === 'document' && DOCUMENT_QUERIES.has(method) && isGlobal(object, sourceCode)) {
    return { subject: 'document', method, call }
  }
  return undefined
}
