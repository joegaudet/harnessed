/**
 * WebDriver's key code points (the "keys" table of the WebDriver spec), by
 * Playwright's key name. These are what selenium-webdriver's `Key` constants
 * hold; written out so the driver needs no runtime import of selenium-webdriver,
 * which Nightwatch keeps as its own dependency.
 */
const NAMED: Readonly<Record<string, string>> = {
  Cancel: '',
  Help: '',
  Backspace: '',
  Tab: '',
  Clear: '',
  Enter: '',
  Shift: '',
  ShiftLeft: '',
  Control: '',
  ControlLeft: '',
  Alt: '',
  AltLeft: '',
  Pause: '',
  Escape: '',
  Space: ' ',
  PageUp: '',
  PageDown: '',
  End: '',
  Home: '',
  ArrowLeft: '',
  ArrowUp: '',
  ArrowRight: '',
  ArrowDown: '',
  Insert: '',
  Delete: '',
  NumpadMultiply: '',
  NumpadAdd: '',
  NumpadSubtract: '',
  NumpadDecimal: '',
  NumpadDivide: '',
  NumpadEnter: '',
  Meta: '',
  MetaLeft: '',
  ShiftRight: '',
  ControlRight: '',
  AltRight: '',
  MetaRight: '',
  // Code names for keys that type a character: the character.
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
}

/** F1–F12 are consecutive from U+E031; Numpad0–9 from U+E01A. */
function numbered(part: string): string | undefined {
  const fn = /^F([1-9]|1[0-2])$/.exec(part)
  if (fn !== null) return String.fromCharCode(0xe031 + Number(fn[1]) - 1)
  const pad = /^Numpad(\d)$/.exec(part)
  if (pad !== null) return String.fromCharCode(0xe01a + Number(pad[1]))
  return undefined
}

/**
 * Playwright's key names — `Enter`, `ArrowLeft`, `Control+a` — as the WebDriver
 * keys to hold down, in order, and then release in reverse: a chord, or a
 * single key. `ControlOrMeta` is Meta on macOS and Control elsewhere, read
 * from the test process's platform, as Playwright reads it.
 *
 * A name the table does not know is an error: typed as text, a misspelt
 * `Entr` would put four letters in the field and press nothing.
 */
export function toKeySequence(key: string, platform: string = process.platform): string[] {
  // `+` alone, or a trailing `++`, is the plus key itself rather than a separator.
  const parts = key.length > 1 ? key.split(/\+(?!$)/) : [key]
  return parts.map(part => {
    // One character — `a`, `+`, `é` — is typed as itself.
    if ([...part].length === 1) return part
    if (part === 'ControlOrMeta') return platform === 'darwin' ? '' : ''
    const named = NAMED[part] ?? numbered(part)
    if (named !== undefined) return named
    const code = /^(?:Key([A-Z])|Digit(\d))$/.exec(part)
    if (code !== null) return (code[1] ?? code[2]!).toLowerCase()
    throw new Error(
      `harnessed: press() does not know the key "${part}"${parts.length > 1 ? ` in "${key}"` : ''}. ` +
        'Use a Playwright key name — Enter, ArrowLeft, Control+a, KeyA, Digit1 — or a single character.',
    )
  })
}
