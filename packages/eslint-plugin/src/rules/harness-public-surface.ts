import type { Rule } from 'eslint'
import type { ClassMember } from '../shared'
import {
  classMembers,
  decoratorNames,
  dirOptionSchema,
  ELEMENT_DECORATORS,
  enclosingClass,
  extendsHarnessBase,
  FIELD_TYPES,
  harnessDirsOf,
  inAnyDir,
  isPublicMember,
  isRunnerModule,
  memberName,
  METHOD_TYPES,
} from '../shared'

/** Element and selector types, from this library and from every runner it replaces. */
const ELEMENT_TYPES = new Set([
  'Query',
  'Selector',
  'Locator',
  'Element',
  'HTMLElement',
  'SVGElement',
  'ElementHandle',
  'WebElement',
  'Chainable',
  'JQuery',
])

/** `HTMLInputElement`, `SVGPathElement`, and the rest of the DOM's element types. */
const DOM_ELEMENT_TYPE = /^(HTML|SVG)\w*Element$/

/** Names that say a parameter carries a selector, whatever its type. Compared lowercased. */
const SELECTOR_PARAM_NAMES = new Set(['selector', 'testid', 'css', 'xpath', 'locator'])

/** Query methods that narrow a query and hand back another query. */
const NARROWING_METHODS = new Set(['first', 'last', 'nth'])

interface Node {
  type: string
  [key: string]: unknown
}

/**
 * The first element type a type annotation mentions, anywhere inside it.
 *
 * Judged by name, since the plugin has no type information. `appNames` are the
 * names this file imports from the app rather than from a runner or the harness
 * API — an app's own `Query` is a domain type, not a harnessed one.
 */
function elementTypeIn(node: unknown, appNames: Set<string>): string | undefined {
  if (node === null || typeof node !== 'object') return undefined
  const typed = node as Node
  if (typed.type === 'TSTypeReference') {
    const typeName = typed.typeName as Node & { name?: string; right?: { name: string } }
    const name = typeName.type === 'TSQualifiedName' ? typeName.right?.name : typeName.name
    const isElementName =
      name !== undefined && (ELEMENT_TYPES.has(name) || DOM_ELEMENT_TYPE.test(name))
    if (isElementName && !(typeName.type === 'Identifier' && appNames.has(name))) return name
  }
  for (const [key, value] of Object.entries(typed)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const children = Array.isArray(value) ? value : [value]
    for (const child of children) {
      const found = elementTypeIn(child, appNames)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** Local names this file imports from anywhere but a runner or `@harnessed-ts/*`. */
function appImportsOf(program: Node): Set<string> {
  const names = new Set<string>()
  for (const statement of program.body as Node[]) {
    if (statement.type !== 'ImportDeclaration') continue
    const source = (statement.source as { value: unknown }).value
    if (typeof source !== 'string') continue
    if (source.startsWith('@harnessed-ts/') || isRunnerModule(source)) continue
    for (const specifier of statement.specifiers as Array<{ local: { name: string } }>) {
      names.add(specifier.local.name)
    }
  }
  return names
}

/** `line` for `this.line`, `#line` for `this.#line`. */
function thisMemberName(node: Node): string | undefined {
  if (node.type !== 'MemberExpression') return undefined
  if ((node.object as Node).type !== 'ThisExpression') return undefined
  const property = node.property as Node & { name?: string }
  if (property.type === 'Identifier') return property.name
  if (property.type === 'PrivateIdentifier') return `#${property.name}`
  return undefined
}

function fieldKey(member: ClassMember): string | undefined {
  const name = memberName(member)
  if (name === undefined) return undefined
  return member.key?.type === 'PrivateIdentifier' ? `#${name}` : name
}

/**
 * True when an expression is a query, not something a query said: `this.self`,
 * `this.elementBy(…)`, a decorated element field, or any of those narrowed by
 * `first()` / `last()` / `nth()`.
 */
function isElement(expression: Node, elementFields: Set<string>): boolean {
  switch (expression.type) {
    case 'AwaitExpression':
      return isElement(expression.argument as Node, elementFields)
    case 'ChainExpression':
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
      return isElement(expression.expression as Node, elementFields)
    case 'ConditionalExpression':
      return (
        isElement(expression.consequent as Node, elementFields) ||
        isElement(expression.alternate as Node, elementFields)
      )
    case 'LogicalExpression':
      return (
        isElement(expression.left as Node, elementFields) ||
        isElement(expression.right as Node, elementFields)
      )
    case 'MemberExpression': {
      const name = thisMemberName(expression)
      return name === 'self' || (name !== undefined && elementFields.has(name))
    }
    case 'CallExpression': {
      const callee = expression.callee as Node
      if (thisMemberName(callee) === 'elementBy') return true
      if (callee.type !== 'MemberExpression') return false
      const property = callee.property as Node & { name?: string }
      if (property.type !== 'Identifier' || !NARROWING_METHODS.has(property.name ?? '')) {
        return false
      }
      return isElement(callee.object as Node, elementFields)
    }
    default:
      return false
  }
}

interface Fn {
  type: string
  returnType?: { typeAnnotation: unknown }
  params: Param[]
  body?: Node
  expression?: boolean
}

interface Field extends ClassMember {
  typeAnnotation?: { typeAnnotation: unknown }
  value?: Node | null
}

function isFunction(node: Node | null | undefined): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'
}

interface Param extends Node {
  name?: string
  typeAnnotation?: unknown
  left?: Param
  argument?: Param
}

/** The binding a parameter declares, seen through a default value or a rest. */
function binding(param: Param): Param {
  if (param.type === 'AssignmentPattern' && param.left !== undefined) return binding(param.left)
  if (param.type === 'RestElement' && param.argument !== undefined) return binding(param.argument)
  return param
}

/**
 * A harness's public surface is the contract a test is written against. If it
 * hands out a `Query`, a locator, or an element — or takes a selector in — the
 * test is now written against the DOM, and a new variant of the app (a native
 * build) needs new tests instead of new harnesses.
 *
 * Element fields stay private. A `@ChildHarness` may be public: it is a harness,
 * so it speaks in behaviours too, and exposing one is how a page composes its
 * components.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow element fields, queries, locators, and selectors on the public surface of a harness.',
      recommended: true,
    },
    schema: [dirOptionSchema],
    messages: {
      publicElementField:
        'Element field `{{name}}` is public. Make it `private accessor` and expose what the element means through a behavioural method. (A @ChildHarness may stay public: it is a harness.)',
      elementReturnType:
        'Public method `{{method}}` returns `{{type}}`. A harness returns domain values or other harnesses, never an element or a selector — a test written against one breaks when the app is rebuilt.',
      returnsElement:
        'Public method `{{method}}` hands out an element. Return what the element says (its text, whether it is shown) or the harness that owns it.',
      elementParameter:
        'Parameter `{{param}}` of public method `{{method}}` carries a selector or an element. Take a domain value — a label, an id, a record — and resolve it inside the harness.',
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}

    const elementFieldsOf = new WeakMap<object, Set<string>>()
    let appNames = new Set<string>()

    function checkClass(node: Rule.Node): void {
      if (!extendsHarnessBase(node)) return
      const members = classMembers(node)
      const elementFields = new Set<string>()
      elementFieldsOf.set(node, elementFields)

      // Decorated fields first: a member may return one declared below it.
      const isElementField = (member: ClassMember) =>
        FIELD_TYPES.has(member.type) &&
        decoratorNames(member).some(name => ELEMENT_DECORATORS.has(name))
      for (const member of members) {
        const key = isElementField(member) ? fieldKey(member) : undefined
        if (key !== undefined) elementFields.add(key)
      }

      for (const member of members) {
        if (METHOD_TYPES.has(member.type)) {
          if (member.kind !== 'constructor') checkFunction(member, member.value as Fn)
          continue
        }
        if (!FIELD_TYPES.has(member.type) || !isPublicMember(member)) continue
        const field = member as Field
        if (isElementField(member)) {
          reportField(member)
        } else if (isFunction(field.value)) {
          // `open = () => this.self` is a method in all but syntax.
          const fn = field.value as unknown as Fn
          checkFunction(member, fn)
          if (fn.expression === true && isElement(fn.body as Node, elementFields)) {
            reportReturn(fn.body as unknown as Rule.Node, member)
          }
        } else if (decoratorNames(member).includes('ChildHarness')) {
          continue
        } else if (
          elementTypeIn(field.typeAnnotation?.typeAnnotation, appNames) !== undefined ||
          (field.value !== null &&
            field.value !== undefined &&
            isElement(field.value, elementFields))
        ) {
          reportField(member)
        }
      }
    }

    function reportField(member: ClassMember): void {
      context.report({
        node: member.key as unknown as Rule.Node,
        messageId: 'publicElementField',
        data: { name: fieldKey(member) ?? '(computed)' },
      })
    }

    function reportReturn(node: Rule.Node, member: ClassMember): void {
      context.report({
        node,
        messageId: 'returnsElement',
        data: { method: memberName(member) ?? '(computed)' },
      })
    }

    function checkFunction(member: ClassMember, fn: Fn): void {
      if (!isPublicMember(member)) return
      const method = memberName(member) ?? '(computed)'

      const returned = elementTypeIn(fn.returnType?.typeAnnotation, appNames)
      if (returned !== undefined) {
        context.report({
          node: fn.returnType as unknown as Rule.Node,
          messageId: 'elementReturnType',
          data: { method, type: returned },
        })
      }

      for (const param of fn.params) {
        const bound = binding(param)
        const named = bound.name !== undefined && SELECTOR_PARAM_NAMES.has(bound.name.toLowerCase())
        // A rest parameter carries its annotation itself, not on its argument.
        const annotation = param.typeAnnotation ?? bound.typeAnnotation
        const typed = elementTypeIn(annotation, appNames) !== undefined
        if (!named && !typed) continue
        context.report({
          node: param as unknown as Rule.Node,
          messageId: 'elementParameter',
          data: { method, param: bound.name ?? '(destructured)' },
        })
      }
    }

    /** The public member a function is the body of, if it is one. */
    function publicMemberOf(fn: Rule.Node): ClassMember | undefined {
      const member = fn.parent as unknown as ClassMember | undefined
      if (member === undefined || !isPublicMember(member)) return undefined
      if (METHOD_TYPES.has(member.type)) {
        return fn.type === 'FunctionExpression' && member.kind !== 'constructor'
          ? member
          : undefined
      }
      return FIELD_TYPES.has(member.type) ? member : undefined
    }

    return {
      Program(node) {
        appNames = appImportsOf(node as unknown as Node)
      },
      ClassDeclaration: node => checkClass(node as unknown as Rule.Node),
      ClassExpression: node => checkClass(node as unknown as Rule.Node),
      ReturnStatement(node) {
        if (node.argument === null || node.argument === undefined) return
        // Only the method's own return: a callback nested inside it returns to
        // whoever called the callback, not to the test.
        let current = (node as unknown as Rule.Node).parent as Rule.Node | null | undefined
        while (
          current &&
          current.type !== 'FunctionExpression' &&
          current.type !== 'ArrowFunctionExpression' &&
          current.type !== 'FunctionDeclaration'
        ) {
          current = current.parent as Rule.Node | null | undefined
        }
        if (current === null || current === undefined) return
        const member = publicMemberOf(current)
        if (member === undefined) return

        const owner = enclosingClass(current)
        if (owner === undefined) return
        const elementFields = elementFieldsOf.get(owner)
        if (elementFields === undefined) return
        if (!isElement(node.argument as unknown as Node, elementFields)) return
        reportReturn(node as unknown as Rule.Node, member)
      },
    }
  },
}

export default rule
