/**
 * How to find something. A Selector is data, not a resolved node — it describes a
 * query that a driver knows how to run.
 */

export interface RoleOptions {
  name?: string | RegExp
  exact?: boolean
  /** Heading level. Both drivers support it, and a screen usually has more than one. */
  level?: number
}

/**
 * `frame: true` marks an `<iframe>`: as a link in a scope chain, the queries
 * scoped under it run inside the frame's document. As the target itself it is
 * still the iframe element — which is what a frame host's `self` addresses.
 */
export type Selector = (
  | { type: 'role'; role: string; options?: RoleOptions }
  | { type: 'label'; text: string | RegExp }
  | { type: 'testId'; testId: string | RegExp }
  | { type: 'text'; text: string | RegExp }
  | { type: 'placeholder'; text: string | RegExp }
) & { nth?: number; frame?: true }

export type SelectorType = Selector['type']

export function role(name: string, options?: RoleOptions): Selector {
  return options === undefined
    ? { type: 'role', role: name }
    : { type: 'role', role: name, options }
}

export function testId(id: string | RegExp): Selector {
  return { type: 'testId', testId: id }
}

export function label(text: string | RegExp): Selector {
  return { type: 'label', text }
}

export function text(value: string | RegExp): Selector {
  return { type: 'text', text: value }
}

export function placeholder(value: string | RegExp): Selector {
  return { type: 'placeholder', text: value }
}

/** Same selector, narrowed to one of several matches. */
export function nth(selector: Selector, index: number): Selector {
  return { ...selector, nth: index }
}

/**
 * An `<iframe>` whose document the scope enters. Use it as a harness's host —
 * `@Harness({ host: frame(testId('checkout')) })` — or pass the plain selector
 * as `@ChildHarness(Checkout, { frame: testId('checkout') })`.
 */
export function frame(selector: Selector): Selector {
  return { ...selector, frame: true }
}

/**
 * Where a global query starts: the scope up to its innermost frame, so a harness
 * nested in a frame finds its own portals rather than the embedding page's nodes.
 */
export function documentScope(scope: readonly Selector[]): readonly Selector[] {
  for (let index = scope.length - 1; index >= 0; index--) {
    if (scope[index]!.frame === true) return scope.slice(0, index + 1)
  }
  return []
}

/** For error messages — a selector rendered the way an author wrote it. */
export function describeSelector(selector: Selector): string {
  const described = describeBare(selector)
  return selector.frame === true ? `frame(${described})` : described
}

function describeBare(selector: Selector): string {
  const suffix = selector.nth === undefined ? '' : `[${selector.nth}]`
  switch (selector.type) {
    case 'role': {
      const opts = selector.options
      const parts: string[] = [JSON.stringify(selector.role)]
      if (opts?.name !== undefined) parts.push(`name=${String(opts.name)}`)
      if (opts?.level !== undefined) parts.push(`level=${opts.level}`)
      if (opts?.exact !== undefined) parts.push(`exact=${opts.exact}`)
      return `role(${parts.join(', ')})${suffix}`
    }
    case 'testId':
      return `testId(${String(selector.testId)})${suffix}`
    case 'label':
      return `label(${String(selector.text)})${suffix}`
    case 'text':
      return `text(${String(selector.text)})${suffix}`
    case 'placeholder':
      return `placeholder(${String(selector.text)})${suffix}`
  }
}

/** For error messages — the scope chain plus the selector, as one path. */
export function describeScope(scope: readonly Selector[], selector: Selector): string {
  return [...scope, selector].map(describeSelector).join(' > ')
}
