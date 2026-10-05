import type { PageApi, PageApiOptions, WireSelector } from '@harnessed-ts/resolve/inject'

/**
 * Code that runs in the browser, not in Node.
 *
 * TestCafe ships a client function to the page as its source text, so nothing
 * here may close over a module binding — every value it needs is an argument
 * or a dependency, and every helper is declared inside the function that uses
 * it. No `async` either: TestCafe refuses client functions that compile to a
 * regenerator, so waiting is written with `.then`.
 */

/** Thrown in the page when the resolver is not there and no source came with the call. */
export const NOT_INJECTED = 'harnessed:not-injected'

/** Every operation answered by one round trip through `pageCall`. */
export type PageOp =
  | 'count'
  | 'texts'
  | 'text'
  | 'value'
  | 'attribute'
  | 'enabled'
  | 'checked'
  | 'selected'
  | 'visible'
  | 'hidden'
  | 'resolve'
  | 'focus'
  | 'blur'
  | 'select'

/** What a page call answers with: the value, and the top-level URL it was read at. */
export interface PageResult {
  value: unknown
  href: string
}

/**
 * One client function for every read: compiled once per test, called with the
 * operation as an argument.
 *
 * `source` is the resolver's injectable build, or `null`. A document that lacks
 * the resolver installs it from the source in the same round trip; without a
 * source it refuses, and the driver calls again with one. `new Function` rather
 * than `eval`: TestCafe rewrites `eval` to process the code it runs, which costs
 * several times what installing the build does.
 *
 * The resolver is looked up in the top-most window that has it, so a call made
 * while TestCafe is switched into an iframe still resolves from the page's own
 * document — the scope chain crosses frames itself, exactly as it does under
 * every other resolver-based driver.
 */
export function pageCall(
  name: string,
  source: string | null,
  op: PageOp,
  scope: WireSelector[],
  selector: WireSelector,
  options: PageApiOptions,
  arg: unknown,
): PageResult | Promise<PageResult> {
  let api: PageApi | null = null
  let home: Window = window
  let current: Window = window
  for (;;) {
    try {
      const found = (current as unknown as Record<string, PageApi | undefined>)[name]
      if (found !== undefined) {
        api = found
        home = current
      }
    } catch {
      // A cross-origin ancestor: the resolver could not cross into it anyway.
      break
    }
    if (current === current.parent) break
    current = current.parent
  }
  if (api === null) {
    // NOT_INJECTED, spelled out: page code cannot reach a module constant.
    if (source === null) throw new Error('harnessed:not-injected')
    // The build installs itself as a global of the window it runs in.
    new Function(source)()
    api = (window as unknown as Record<string, PageApi>)[name]
    home = window
  }
  const resolver: PageApi = api
  const href = home.location.href
  const done = (value: unknown): PageResult => ({ value, href })

  // Playwright's definition, so the two browser drivers agree: a non-empty box
  // and not `visibility: hidden`. A frame that is itself hidden hides its
  // content, so the walk carries on through every enclosing iframe.
  const isVisible = (element: Element): boolean => {
    let node: Element | null = element
    while (node !== null) {
      const view: Window | null = node.ownerDocument.defaultView
      if (view === null) return false
      const box = node.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return false
      if (view.getComputedStyle(node).visibility === 'hidden') return false
      node = view === home ? null : view.frameElement
    }
    return true
  }

  const one = (): Promise<Element> => resolver.one(null, scope, selector, options)

  switch (op) {
    case 'count':
      return done(resolver.allNow(null, scope, selector, options).length)
    case 'texts':
      return done(
        resolver
          .allNow(null, scope, selector, options)
          .map(node => (node.textContent ?? '').trim()),
      )
    case 'visible': {
      const node = resolver.oneNow(null, scope, selector, options)
      return done(node !== null && isVisible(node))
    }
    case 'hidden': {
      const node = resolver.oneNow(null, scope, selector, options)
      return done(node === null || !isVisible(node))
    }
    case 'text':
      return one().then(node => done((node.textContent ?? '').trim()))
    case 'value':
      return one().then(node => done((node as HTMLInputElement).value ?? ''))
    case 'attribute':
      return one().then(node => done(node.getAttribute(arg as string)))
    case 'enabled':
      // `disabled` is inherited from an ancestor fieldset; `:disabled` sees that
      // where the element's own attribute does not.
      return one().then(node =>
        done([
          (node as HTMLInputElement).disabled === true || node.closest(':disabled') !== null,
          node.getAttribute('aria-disabled'),
        ]),
      )
    case 'checked':
      return one().then(node =>
        done([node.getAttribute('aria-checked'), Boolean((node as HTMLInputElement).checked)]),
      )
    case 'selected':
      return one().then(node =>
        done(
          Array.prototype.map.call(
            (node as HTMLSelectElement).selectedOptions ?? [],
            (option: HTMLOptionElement) => option.value,
          ),
        ),
      )
    case 'resolve':
      return one().then(() => done(null))
    case 'focus':
      return one().then(node => {
        ;(node as HTMLElement).focus()
        return done(null)
      })
    case 'blur':
      return one().then(node => {
        ;(node as HTMLElement).blur()
        return done(null)
      })
    case 'select':
      return one().then(node => {
        if (node.localName !== 'select') {
          throw new Error(
            `harnessed: selectOption() needs a <select>, but the target is a <${node.localName}>.`,
          )
        }
        const element = node as HTMLSelectElement
        const all: HTMLOptionElement[] = Array.prototype.slice.call(element.options)
        const wanted = arg as string[]
        // By value first, then by label — what Playwright's selectOption matches.
        const picked = wanted.map(value => {
          const option =
            all.find(candidate => candidate.value === value) ??
            all.find(candidate => candidate.label === value)
          if (option === undefined) throw new Error(`harnessed: no <option> matches "${value}".`)
          return option
        })
        if (!element.multiple && picked.length > 1) {
          throw new Error(
            'harnessed: selectOption() was given several values for a single <select>.',
          )
        }
        // Replaces the selection, as Playwright does, rather than adding to it.
        for (const option of all) option.selected = picked.includes(option)
        const view = element.ownerDocument.defaultView ?? window
        element.dispatchEvent(new view.Event('input', { bubbles: true }))
        element.dispatchEvent(new view.Event('change', { bubbles: true }))
        return done(null)
      })
  }
}

/**
 * The node an action targets, for a TestCafe `Selector`. Synchronous, as a
 * selector's init function must be: "not there yet" is an empty list and
 * TestCafe's own retry does the waiting. An empty list rather than `null` keeps
 * the return within TestCafe's declared selector types.
 */
export function pickTarget(): Element[] {
  // Dependencies, declared for the type checker. TestCafe defines each one as a
  // variable in the function's scope before running it.
  const { name, scope, selector, options } = harnessedTarget
  let api: PageApi | null = null
  let current: Window = window
  for (;;) {
    try {
      const found = (current as unknown as Record<string, PageApi | undefined>)[name]
      if (found !== undefined) api = found
    } catch {
      break
    }
    if (current === current.parent) break
    current = current.parent
  }
  if (api === null) return []
  const node = api.oneNow(null, scope, selector, options)
  return node === null ? [] : [node]
}

/** The shape of `pickTarget`'s one dependency. */
export interface TargetDependency {
  name: string
  scope: WireSelector[]
  selector: WireSelector
  options: PageApiOptions
}

declare const harnessedTarget: TargetDependency

/** The current top-level URL, without needing the resolver. */
export function currentHref(): string {
  return window.location.href
}
