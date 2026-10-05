/**
 * Trusted input through the Chrome DevTools Protocol, for `realEvents: true`.
 *
 * Cypress's own `trigger` and the cypress-real-events commands are `cy`
 * commands, and a harness runs inside a promise where nothing can be enqueued.
 * `Cypress.automation('remote:debugger:protocol')` is the one way to reach CDP
 * that is itself a promise. The browser then produces the events — `isTrusted`,
 * default actions and all — rather than a script imitating them.
 */

interface KeyDefinition {
  code: string
  keyCode: number
  /** What the key types, for the keys that type something. */
  text?: string
}

/** The named keys a harness presses. Printable characters are derived instead. */
const NAMED_KEYS: Record<string, KeyDefinition> = {
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Tab: { code: 'Tab', keyCode: 9 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  Delete: { code: 'Delete', keyCode: 46 },
  Escape: { code: 'Escape', keyCode: 27 },
  Space: { code: 'Space', keyCode: 32, text: ' ' },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  Home: { code: 'Home', keyCode: 36 },
  End: { code: 'End', keyCode: 35 },
  PageUp: { code: 'PageUp', keyCode: 33 },
  PageDown: { code: 'PageDown', keyCode: 34 },
  Insert: { code: 'Insert', keyCode: 45 },
}

function keyDefinition(key: string): { key: string } & KeyDefinition {
  const named = NAMED_KEYS[key]
  if (named !== undefined) return { key: key === 'Space' ? ' ' : key, ...named }
  if ([...key].length === 1) {
    const upper = key.toUpperCase()
    const code = /[A-Z]/.test(upper) ? `Key${upper}` : /[0-9]/.test(key) ? `Digit${key}` : ''
    const keyCode = /[A-Z0-9]/.test(upper) ? upper.charCodeAt(0) : 0
    return { key, code, keyCode, text: key }
  }
  throw new Error(
    `harnessed: realEvents cannot press "${key}". It presses single characters and ` +
      `${Object.keys(NAMED_KEYS).join(', ')}; drop realEvents to press it through user-event.`,
  )
}

function send(command: string, params: Record<string, unknown>): Promise<unknown> {
  return Promise.resolve(Cypress.automation('remote:debugger:protocol', { command, params }))
}

/** Refuses early and by name, instead of failing inside the automation channel. */
export function requireChromium(): void {
  if (!Cypress.isBrowser({ family: 'chromium' })) {
    throw new Error(
      `harnessed: realEvents drives Chrome DevTools Protocol input, which only ` +
        `Chromium-family browsers (Chrome, Edge, Electron) have; this run is in ` +
        `${Cypress.browser.name}. Leave realEvents off to use user-event there.`,
    )
  }
}

/**
 * The `<iframe>` elements between the top-level page and `target`, outermost
 * first. Searched for from the top rather than climbed to with `frameElement`,
 * because Cypress hides the AUT's `frameElement` from the app (it reads `null`).
 */
function framesDownTo(target: Window, within: Document): HTMLIFrameElement[] | null {
  for (const frame of within.querySelectorAll('iframe')) {
    if (frame.contentWindow === target) return [frame]
    // A cross-origin frame's document is null: nothing to search in it.
    const inner = frame.contentDocument
    const path = inner === null ? null : framesDownTo(target, inner)
    if (path !== null) return [frame, ...path]
  }
  return null
}

/**
 * The centre of an element in the top-level viewport, which is where CDP input
 * is addressed. The AUT is a frame inside Cypress's runner — scaled to fit it,
 * in run mode — and a framed harness adds frames of its own, so each level adds
 * its frame's offset and scales by the transform the runner put on it.
 */
function centreOf(element: Element): { x: number; y: number } {
  element.scrollIntoView({ block: 'center', inline: 'center' })
  const box = element.getBoundingClientRect()
  let x = box.left + box.width / 2
  let y = box.top + box.height / 2
  const view = element.ownerDocument.defaultView
  const top = window.top ?? window
  const frames = view === null || view === top ? [] : (framesDownTo(view, top.document) ?? [])
  for (const frame of frames.reverse()) {
    const frameBox = frame.getBoundingClientRect()
    const scale = frame.offsetWidth > 0 ? frameBox.width / frame.offsetWidth : 1
    const style = frame.ownerDocument.defaultView?.getComputedStyle(frame)
    const insetX = frame.clientLeft + parseFloat(style?.paddingLeft ?? '0')
    const insetY = frame.clientTop + parseFloat(style?.paddingTop ?? '0')
    x = frameBox.left + (insetX + x) * scale
    y = frameBox.top + (insetY + y) * scale
  }
  return { x, y }
}

export async function realHover(element: Element): Promise<void> {
  const { x, y } = centreOf(element)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
}

export async function realClick(element: Element): Promise<void> {
  const { x, y } = centreOf(element)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  const press = { x, y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', buttons: 1, ...press })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', buttons: 0, ...press })
}

/** One key, down then up, into whatever has focus. */
export async function realPress(key: string): Promise<void> {
  const { text, keyCode, ...definition } = keyDefinition(key)
  const common = { ...definition, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }
  // `keyDown` with text is what types; a key that types nothing is a raw key.
  await send(
    'Input.dispatchKeyEvent',
    text === undefined
      ? { type: 'rawKeyDown', ...common }
      : { type: 'keyDown', text, unmodifiedText: text, ...common },
  )
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...common })
}

/** Text into whatever has focus, the way an IME commits it — Playwright's `fill`. */
export async function realInsertText(text: string): Promise<void> {
  await send('Input.insertText', { text })
}
