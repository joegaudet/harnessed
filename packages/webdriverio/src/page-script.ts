import type { PageApi, PageApiOptions, WireSelector } from '@harnessed-ts/resolve/inject'

/**
 * What the in-page script does with the target it resolves. Reads happen in the
 * page, in the same round-trip as the resolution: a WebDriver command costs a
 * few milliseconds each way, and a read that first fetched an element reference
 * and then asked about it would pay that twice.
 */
export type PageOp =
  | 'frame'
  | 'frameNow'
  | 'element'
  | 'probe'
  | 'count'
  | 'texts'
  | 'text'
  | 'value'
  | 'attribute'
  | 'enabled'
  | 'checked'
  | 'selected'
  | 'select'
  | 'clear'
  | 'focus'
  | 'blur'

/**
 * The script's answer. A page error comes back as a value rather than a thrown
 * script error, so its name and message arrive intact — a thrown one reaches the
 * test wrapped in protocol noise, and under WebDriver Classic is logged as a
 * driver failure as well.
 */
export type PageReply =
  | { kind: 'missing' }
  | { kind: 'ok'; value: unknown; url: string }
  | { kind: 'error'; name: string; message: string }

/** Raised in the page by the shared resolver: strictness, index and frame rules. */
export class PageError extends Error {
  constructor(name: string, message: string) {
    super(message)
    this.name = name
  }
}

/** The shared resolver's refusal of a frame it cannot enter. Never "not there yet". */
export function isFrameEntryError(error: unknown): boolean {
  return error instanceof PageError && error.name === 'FrameEntryError'
}

/** An element as WebDriver returns it from a script, before `$()` wraps it. */
export type ElementRef = { 'element-6066-11e4-a52e-4f735466cecf': string }

/**
 * Runs IN THE PAGE, serialised with `Function.prototype.toString`, so it must
 * close over nothing: every input arrives as an argument. Elements are
 * only ever returned as object properties, each at most once — WebDriver BiDi
 * serialises an element repeated in a result, or one inside an array, as `{}`.
 */
export async function pageScript(
  name: string,
  op: PageOp,
  scope: WireSelector[],
  selector: WireSelector,
  options: PageApiOptions,
  arg: string | null,
): Promise<PageReply> {
  const api = (window as unknown as Record<string, PageApi | undefined>)[name]
  // Navigation replaces the window, and the resolver with it.
  if (api === undefined) return { kind: 'missing' }
  const one = () => api.one(null, scope, selector, options)
  /**
   * A frame link must land on an iframe. When it does not, walking through the
   * same link with the shared resolver raises its FrameEntryError, so the
   * refusal and its wording stay the resolver's rather than a copy kept here.
   */
  const iframe = async (found: Element | null): Promise<Element | null> => {
    if (found !== null && found.localName !== 'iframe') {
      await api.count(null, [...scope, selector], selector, options)
    }
    return found
  }
  try {
    let value: unknown
    switch (op) {
      case 'frame':
        value = { element: await iframe(await one()) }
        break
      case 'frameNow':
        value = { element: await iframe(api.oneNow(null, scope, selector, options)) }
        break
      case 'element':
        value = { element: await one() }
        break
      case 'probe': {
        // `allNow` applies `nth` and answers at once; the caller decides what
        // more than one match means, with the whole scope chain in hand.
        const matches = api.allNow(null, scope, selector, options)
        value = { count: matches.length, element: matches.length === 1 ? matches[0] : null }
        break
      }
      case 'count':
        value = await api.count(null, scope, selector, options)
        break
      case 'texts': {
        const matches = await api.all(null, scope, selector, options)
        const index = (selector as { nth?: number }).nth
        const listed = index === undefined ? matches : matches.slice(index, index + 1)
        value = listed.map(element => element.textContent ?? '')
        break
      }
      case 'text':
        value = (await one()).textContent ?? ''
        break
      case 'value':
        value = ((await one()) as HTMLInputElement).value ?? ''
        break
      case 'attribute':
        value = (await one()).getAttribute(arg ?? '')
        break
      case 'enabled': {
        const element = (await one()) as HTMLInputElement
        // The property, and the closest `:disabled`, both see an ancestor
        // fieldset's `disabled`; the element's own attribute does not.
        value = {
          disabled: element.disabled === true || element.closest(':disabled') !== null,
          aria: element.getAttribute('aria-disabled'),
        }
        break
      }
      case 'checked': {
        const element = (await one()) as HTMLInputElement
        value = {
          element,
          aria: element.getAttribute('aria-checked'),
          native: Boolean(element.checked),
        }
        break
      }
      case 'selected': {
        const element = (await one()) as HTMLSelectElement
        value = [...(element.selectedOptions ?? [])].map(option => option.value)
        break
      }
      case 'select': {
        const element = (await one()) as HTMLSelectElement
        value = {
          element,
          multiple: element.multiple,
          selected: [...(element.selectedOptions ?? [])].map(option => option.value),
          // What each option can be chosen by: its value, or the label it shows.
          options: [...(element.options ?? [])].map(option => ({
            value: option.value,
            label: option.label.trim(),
          })),
        }
        break
      }
      case 'clear': {
        const element = (await one()) as HTMLInputElement
        // WebdriverIO sets these input types' values directly: they take no typing.
        const direct = ['range', 'date', 'datetime-local', 'month', 'week', 'time', 'color']
        element.focus()
        // Selected, so one Backspace deletes it all: a real edit, which fires the
        // input events a controlled component listens for.
        if (typeof element.select === 'function') element.select()
        else window.getSelection()?.selectAllChildren(element)
        value = {
          element,
          direct: element.localName === 'input' && direct.includes(element.type),
          filled: (element.value ?? element.textContent ?? '') !== '',
        }
        break
      }
      case 'focus':
        ;((await one()) as HTMLElement).focus()
        value = null
        break
      case 'blur':
        ;((await one()) as HTMLElement).blur()
        value = null
        break
    }
    return { kind: 'ok', value, url: location.href }
  } catch (error) {
    const { name = 'Error', message = String(error) } = (error ?? {}) as Partial<Error>
    return { kind: 'error', name, message }
  }
}
