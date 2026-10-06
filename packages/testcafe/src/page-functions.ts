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
  | 'editable'
  | 'focus'
  | 'blur'
  | 'select'

/**
 * How a single-target operation looks for its node. `now` answers at once,
 * with `absent` when nothing matches yet, so the driver polls from Node; `wait`
 * waits in the page for `options.timeout`, and is what the last poll uses so
 * that a target never found fails in the resolver's own words. `count` and
 * `texts` never wait in the page: they answer `absent` while their scope is
 * not on screen, whichever lookup is asked for.
 */
export type Lookup = 'now' | 'wait'

/** What a page call answers with: the value, and the top-level URL it was read at. */
export interface PageResult {
  value: unknown
  href: string
  /** A `now` lookup, or a list's scope, found nothing to answer about yet. */
  absent?: true
}

/** What `select` takes: the values to pick, and the target named for its errors. */
export interface SelectArg {
  values: string[]
  target: string
}

/**
 * Whether a node can be typed into: `ok`, why not yet (`disabled`, `readonly`),
 * or — when it is not a text control at all — its tag, as `<div>`.
 */
export type Editable = 'ok' | 'disabled' | 'readonly' | `<${string}>`

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
  lookup: Lookup,
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

  // The shared layout rule, judged in each element's own document, carried on
  // through every iframe the scope entered: a hidden frame hides its content.
  const isVisible = (element: Element): boolean => {
    let node: Element | null = element
    while (node !== null) {
      if (!resolver.visible(node)) return false
      const view: Window | null = node.ownerDocument.defaultView
      node = view === null || view === home ? null : view.frameElement
    }
    return true
  }

  // A single target. `now` hands back `null` for "not there yet"; the driver
  // polls, so a wait never holds TestCafe's one command queue for long.
  const target = (): Promise<Element | null> =>
    lookup === 'now'
      ? Promise.resolve(resolver.oneNow(null, scope, selector, options))
      : resolver.one(null, scope, selector, options)
  const withTarget = (read: (node: Element) => unknown): Promise<PageResult> =>
    target().then(node => (node === null ? { value: null, href, absent: true } : done(read(node))))

  // Every match now, or `null` while a link of the scope is not on screen yet —
  // the driver polls that, as it does a single target. The last link is looked
  // up as the element it names, so "absent" is told apart from what
  // `allNow` folds into an empty list: an ambiguous or out-of-range link, which
  // holds nothing at once, as `count` says under every driver. A frame that
  // cannot be entered still throws.
  const list = (): Element[] | null => {
    if (scope.length > 0) {
      const last = Object.assign({}, scope[scope.length - 1], { frame: false })
      let link: Element | null
      try {
        link = resolver.oneNow(null, scope.slice(0, -1), last, options)
      } catch (error) {
        if ((error as { name?: string } | null)?.name === 'FrameEntryError') throw error
        return []
      }
      if (link === null) return null
    }
    // `nth` picks one match, or none: a list read through `nth()` is that one.
    return resolver.allNow(null, scope, selector, options)
  }
  const withList = (read: (matches: Element[]) => unknown): PageResult => {
    const matches = list()
    return matches === null ? { value: null, href, absent: true } : done(read(matches))
  }

  switch (op) {
    case 'count':
      return withList(matches => matches.length)
    case 'texts':
      return withList(matches => matches.map(node => (node.textContent ?? '').trim()))
    case 'visible': {
      const node = resolver.oneNow(null, scope, selector, options)
      return done(node !== null && isVisible(node))
    }
    case 'hidden': {
      const node = resolver.oneNow(null, scope, selector, options)
      return done(node === null || !isVisible(node))
    }
    case 'text':
      return withTarget(node => (node.textContent ?? '').trim())
    case 'value':
      return withTarget(node => (node as HTMLInputElement).value ?? '')
    case 'attribute':
      return withTarget(node => node.getAttribute(arg as string))
    case 'enabled':
      // `disabled` is inherited from an ancestor fieldset; `:disabled` sees that
      // where the element's own attribute does not.
      return withTarget(node => [
        (node as HTMLInputElement).disabled === true || node.closest(':disabled') !== null,
        node.getAttribute('aria-disabled'),
      ])
    case 'checked':
      return withTarget(node => [
        node.getAttribute('aria-checked'),
        Boolean((node as HTMLInputElement).checked),
      ])
    case 'selected':
      return withTarget(node =>
        Array.prototype.map.call(
          (node as HTMLSelectElement).selectedOptions ?? [],
          (option: HTMLOptionElement) => option.value,
        ),
      )
    case 'resolve':
      return withTarget(() => null)
    case 'editable':
      // TestCafe's typeText types into the first editable descendant of a
      // wrapper, and does nothing at all to a disabled or readonly control; both
      // are refused before it is asked. So is an <input> that takes no text — a
      // checkbox, a file — which Playwright's fill refuses too, and a control
      // `aria-disabled` marks, which `isEnabled()` reads as disabled.
      return withTarget((node): Editable => {
        const input = node.localName === 'input'
        const control = input || node.localName === 'textarea'
        if (!control && !(node as HTMLElement).isContentEditable) return `<${node.localName}>`
        if (input) {
          const type = (node as HTMLInputElement).type.toLowerCase()
          // Typed into, or set as a value: the types Playwright's fill takes.
          const fillable =
            /^(?:|email|number|password|search|tel|text|url|color|date|time|datetime|datetime-local|month|range|week)$/
          if (!fillable.test(type)) return `<input type="${type}">`
        }
        if (control && node.matches(':disabled')) return 'disabled'
        if (node.getAttribute('aria-disabled') === 'true') return 'disabled'
        if (control && (node as HTMLInputElement).readOnly) return 'readonly'
        return 'ok'
      })
    case 'focus':
      return withTarget(node => {
        ;(node as HTMLElement).focus()
        return null
      })
    case 'blur':
      return withTarget(node => {
        ;(node as HTMLElement).blur()
        return null
      })
    case 'select':
      return withTarget(node => {
        const { values, target: named } = arg as SelectArg
        if (node.localName !== 'select') {
          throw new Error(
            `harnessed: selectOption() needs a <select>, but ${named} is a <${node.localName}>.`,
          )
        }
        const element = node as HTMLSelectElement
        const all: HTMLOptionElement[] = Array.prototype.slice.call(element.options)
        // By value first, then by label — what Playwright's selectOption matches.
        const picked = values.map(value => {
          const option =
            all.find(candidate => candidate.value === value) ??
            all.find(candidate => candidate.label === value)
          if (option === undefined) {
            throw new Error(`harnessed: no <option> of ${named} matches "${value}".`)
          }
          return option
        })
        if (!element.multiple && picked.length > 1) {
          throw new Error(
            `harnessed: selectOption() was given several values for ${named}, a single-select.`,
          )
        }
        // Replaces the selection, as Playwright does, rather than adding to it.
        for (const option of all) option.selected = picked.includes(option)
        const view = element.ownerDocument.defaultView ?? window
        element.dispatchEvent(new view.Event('input', { bubbles: true, composed: true }))
        element.dispatchEvent(new view.Event('change', { bubbles: true }))
        return null
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

/** The browser's platform, which decides what `ControlOrMeta` presses. */
export function browserPlatform(): string {
  return window.navigator.platform
}
