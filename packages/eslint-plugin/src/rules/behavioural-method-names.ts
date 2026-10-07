import type { Rule } from 'eslint'
import {
  classMembers,
  dirOptionSchema,
  extendsHarnessBase,
  FIELD_TYPES,
  harnessDirsOf,
  inAnyDir,
  isPublicMember,
  memberName,
  METHOD_TYPES,
} from '../shared'

interface Options {
  /** Mechanical verbs a public method may not start with. Replaces the default. */
  verbs?: string[]
  /** DOM nouns a public method may not mention. Replaces the default. */
  nouns?: string[]
  /** Method names to accept anyway. */
  allow?: string[]
}

/** What a driver does, rather than what a user means. */
const DEFAULT_VERBS = [
  'click',
  'doubleClick',
  'rightClick',
  'tap',
  'hover',
  'fill',
  'type',
  'press',
  'scroll',
  'focus',
  'blur',
  'find',
]

/** What the markup is made of, rather than what the screen means. Covers `get…Element`. */
const DEFAULT_NOUNS = [
  'Button',
  'Input',
  'Field',
  'Div',
  'Element',
  'Locator',
  'Selector',
  'TestId',
  'Css',
]

/** `getSubmitElement` → `['get', 'submit', 'element']`. `submitCSS` → `['submit', 'css']`. */
function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_$]+/)
    .filter(word => word.length > 0)
    .map(word => word.toLowerCase())
}

function startsWithWords(haystack: string[], needle: string[]): boolean {
  return needle.every((word, index) => haystack[index] === word)
}

function containsWords(haystack: string[], needle: string[]): boolean {
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, index) => haystack[start + index] === word)) return true
  }
  return false
}

/**
 * A heuristic, so a warning. A public harness method named for a mechanic —
 * `clickSubmit()`, `fillEmailInput()` — describes how the web build happens to
 * work, and stops making sense the moment the app is rebuilt natively. Named for
 * intent — `submit()`, `signIn(email)` — it survives unchanged; only its body
 * moves.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer public harness method names that describe user intent over driver mechanics or DOM nouns.',
      recommended: true,
    },
    schema: [
      {
        ...dirOptionSchema,
        properties: {
          ...dirOptionSchema.properties,
          verbs: { type: 'array', items: { type: 'string' } },
          nouns: { type: 'array', items: { type: 'string' } },
          allow: { type: 'array', items: { type: 'string' } },
        },
      },
    ],
    messages: {
      mechanicalVerb:
        "`{{name}}` starts with the mechanic '{{verb}}'. Name it for what the user means — submit(), signIn(email), chooseCard('Medium') — so it still makes sense when the app is rebuilt.",
      domNoun:
        "`{{name}}` names the DOM noun '{{noun}}'. Name it for what the screen means — submit(), errorMessage(), chooseCard('Medium') — so it still makes sense when the app is rebuilt.",
    },
  },
  create(context) {
    if (!inAnyDir(context.filename, harnessDirsOf(context))) return {}
    const options = (context.options[0] ?? {}) as Options
    const verbs = (options.verbs ?? DEFAULT_VERBS).map(verb => ({ verb, words: words(verb) }))
    const nouns = (options.nouns ?? DEFAULT_NOUNS).map(noun => ({ noun, words: words(noun) }))
    const allow = new Set(options.allow ?? [])

    function checkClass(node: Rule.Node): void {
      if (!extendsHarnessBase(node)) return
      const members = classMembers(node)
      for (const member of members) {
        // A field holding a function (`submit = async () => {}`) is a method too.
        const value = member.value as { type?: string } | null | undefined
        const isFunctionField =
          FIELD_TYPES.has(member.type) &&
          (value?.type === 'ArrowFunctionExpression' || value?.type === 'FunctionExpression')
        const isMethod = METHOD_TYPES.has(member.type) && member.kind !== 'constructor'
        if (!isMethod && !isFunctionField) continue
        if (!isPublicMember(member)) continue
        const name = memberName(member)
        if (name === undefined || allow.has(name)) continue

        const nameWords = words(name)
        const verb = verbs.find(candidate => startsWithWords(nameWords, candidate.words))
        if (verb !== undefined) {
          context.report({
            node: member.key as unknown as Rule.Node,
            messageId: 'mechanicalVerb',
            data: { name, verb: verb.verb },
          })
          continue
        }
        const noun = nouns.find(candidate => containsWords(nameWords, candidate.words))
        if (noun !== undefined) {
          context.report({
            node: member.key as unknown as Rule.Node,
            messageId: 'domNoun',
            data: { name, noun: noun.noun },
          })
        }
      }
    }

    return {
      ClassDeclaration: node => checkClass(node as unknown as Rule.Node),
      ClassExpression: node => checkClass(node as unknown as Rule.Node),
    }
  },
}

export default rule
