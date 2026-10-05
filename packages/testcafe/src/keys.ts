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

/** `Control+Shift+ArrowLeft` → `ctrl+shift+left`. A lone `+` is the plus key. */
export function toTestCafeKey(key: string): string {
  if (key === '+') return '+'
  return key
    .split('+')
    .map(part => NAMES[part] ?? (part.length === 1 ? part : part.toLowerCase()))
    .join('+')
}
