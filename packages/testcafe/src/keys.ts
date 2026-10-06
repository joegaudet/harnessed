/**
 * Playwright key names, which the shared `press()` takes, onto TestCafe's
 * `pressKey` names. TestCafe lowercases its own and shortens a few; a printable
 * character passes through, except a space, which `pressKey` would read as a
 * separator between two keys.
 */
const NAMES: Record<string, string> = {
  ' ': 'space',
  Space: 'space',
  Enter: 'enter',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'delete',
  Escape: 'esc',
  Insert: 'ins',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Control: 'ctrl',
  Shift: 'shift',
  Alt: 'alt',
  Meta: 'meta',
  CapsLock: 'capslock',
}

/**
 * Every multi-character name TestCafe's `pressKey` accepts: its modifiers and
 * its special keys. Anything else it rejects with an opaque "incorrect key"
 * error, so a name outside this set is refused here first, with the key named.
 */
const SUPPORTED = new Set([
  'alt',
  'ctrl',
  'meta',
  'shift',
  'backspace',
  'capslock',
  'delete',
  'down',
  'end',
  'enter',
  'esc',
  'home',
  'ins',
  'left',
  'pagedown',
  'pageup',
  'right',
  'space',
  'tab',
  'up',
])

/** A chord's parts. A lone `+` is the plus key, and `Control++` holds Control over it. */
function parts(key: string): string[] {
  if (key.length <= 1) return [key]
  const plus = key.endsWith('++')
  const split = (plus ? key.slice(0, -2) : key).split('+')
  return plus ? [...split, '+'] : split
}

function toPart(part: string, platform: string | undefined): string | undefined {
  if (part === 'ControlOrMeta') {
    return platform !== undefined && /^(?:Mac|iP)/.test(platform) ? 'meta' : 'ctrl'
  }
  const code = /^(?:Key([A-Z])|Digit(\d))$/.exec(part)
  if (code !== null) return (code[1] ?? code[2]!).toLowerCase()
  const named = NAMES[part]
  if (named !== undefined) return named
  if (part.length === 1) return part
  return SUPPORTED.has(part) ? part : undefined
}

/**
 * `Control+Shift+ArrowLeft` → `ctrl+shift+left`, `ControlOrMeta+KeyA` →
 * `meta+a` in a browser on macOS. Throws before anything is pressed for a key
 * TestCafe has no way to send, such as a function key.
 *
 * `platform` is the browser's `navigator.platform`, which only `ControlOrMeta`
 * reads: the browser may run on another machine than the test runner.
 */
export function toTestCafeKey(key: string, platform?: string): string {
  return parts(key)
    .map(part => {
      const mapped = toPart(part, platform)
      if (mapped === undefined) {
        throw new Error(
          `harnessed: press() cannot send "${key}" under TestCafe, which has no "${part}" key.`,
        )
      }
      return mapped
    })
    .join('+')
}
