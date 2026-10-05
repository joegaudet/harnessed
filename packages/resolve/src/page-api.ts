import { configure } from '@harnessed-ts/core'
import type { Selector } from '@harnessed-ts/core'
import { PAGE_API_GLOBAL } from './global-name'
import { countAll, resolveAll, resolveAllNow, resolveOne, resolveOneNow } from './resolve'
import { decodeSelector } from './wire'
import type { WireSelector } from './wire'

export { PAGE_API_GLOBAL }

/**
 * Settings a remote driver passes on every call. The page has no access to the
 * test process's `configure()`, so the runtime config travels with the call
 * rather than being pushed once.
 */
/** A selector as handed over the wire, or as-is when caller and page share a realm. */
type Wire = Selector | WireSelector

export interface PageApiOptions {
  testIdAttribute: string
  timeout: number
}

/**
 * The resolver as seen from inside a page a driver does not share a realm with
 * — WebdriverIO, Puppeteer, TestCafe. Every argument is serialisable except
 * `root`, which is an element handle the driver passes back in (or `null` for
 * the document body).
 *
 * The same functions back the dom driver, so role, label, strictness, index
 * and frame semantics cannot differ between a driver resolving in-process and
 * one resolving through this.
 */
export interface PageApi {
  /** How many nodes match. The scope waits; the count does not. */
  count(
    root: Element | null,
    scope: Wire[],
    selector: Wire,
    options: PageApiOptions,
  ): Promise<number>
  /** The single node a strict operation acts on, waiting for it. */
  one(
    root: Element | null,
    scope: Wire[],
    selector: Wire,
    options: PageApiOptions,
  ): Promise<Element>
  /** Every match, after waiting for the scope. `nth` is ignored, as for any list. */
  all(
    root: Element | null,
    scope: Wire[],
    selector: Wire,
    options: PageApiOptions,
  ): Promise<Element[]>
  /** The single node now, or `null`. For runtimes that do their own retrying. */
  oneNow(
    root: Element | null,
    scope: Wire[],
    selector: Wire,
    options: PageApiOptions,
  ): Element | null
  /** Every match now. */
  allNow(root: Element | null, scope: Wire[], selector: Wire, options: PageApiOptions): Element[]
}

export function createPageApi(document: Document): PageApi {
  const start = (root: Element | null): HTMLElement => (root ?? document.body) as HTMLElement
  // Only the test-id attribute: every waiting call passes its timeout
  // explicitly. Note this writes the page's harnessed config, so the API belongs
  // in a page that runs no harnesses of its own — which is every remote page.
  const apply = (options: PageApiOptions): void =>
    configure({ testIdAttribute: options.testIdAttribute })
  const decode = (scope: Wire[], selector: Wire): [Selector[], Selector] => [
    scope.map(decodeSelector),
    decodeSelector(selector),
  ]

  return {
    async count(root, scope, selector, options) {
      apply(options)
      const [steps, target] = decode(scope, selector)
      return countAll(start(root), steps, target, options.timeout)
    },
    async one(root, scope, selector, options) {
      apply(options)
      const [steps, target] = decode(scope, selector)
      return resolveOne(start(root), steps, target, options.timeout)
    },
    async all(root, scope, selector, options) {
      apply(options)
      const [steps, target] = decode(scope, selector)
      return resolveAll(start(root), steps, target, options.timeout)
    },
    oneNow(root, scope, selector, options) {
      apply(options)
      const [steps, target] = decode(scope, selector)
      return resolveOneNow(start(root), steps, target)
    },
    allNow(root, scope, selector, options) {
      apply(options)
      const [steps, target] = decode(scope, selector)
      return resolveAllNow(start(root), steps, target)
    },
  }
}
