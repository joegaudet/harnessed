import { Key } from 'webdriverio'

/**
 * Playwright key names WebdriverIO's table lacks, as what WebdriverIO sends for
 * them: a code that types a character, a left or right modifier, a numpad key.
 */
const PLAYWRIGHT_ONLY: Readonly<Record<string, string>> = {
  ControlOrMeta: Key.Ctrl,
  Meta: Key.Command,
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  ShiftLeft: Key.Shift,
  ShiftRight: Key.Shift,
  ControlLeft: Key.Control,
  ControlRight: Key.Control,
  AltLeft: Key.Alt,
  AltRight: Key.Alt,
  MetaLeft: Key.Command,
  MetaRight: Key.Command,
  NumpadAdd: Key.Add,
  NumpadSubtract: Key.Subtract,
  NumpadMultiply: Key.Multiply,
  NumpadDivide: Key.Divide,
  NumpadDecimal: Key.Decimal,
  NumpadEnter: Key.Enter,
}

/**
 * WebdriverIO's own key names, as what they send. The values, not the names:
 * `keys()` reads a name through a table spelt differently in places — `Numpad 0`
 * for `Key.Numpad0` — and would type `Numpad0` or `Ctrl` as letters.
 */
const WEBDRIVERIO_KEYS: Readonly<Record<string, string>> = Key

/**
 * Playwright's key names — `Enter`, `ArrowLeft`, `Control+a` — as the sequence
 * WebdriverIO's `keys()` takes. WebdriverIO already knows most names
 * (`Enter`, `Backspace`, `Shift`, `F1`…); this covers the rest: a `+` chord,
 * `KeyA`/`Digit1` codes, `ControlOrMeta` and the codes in `PLAYWRIGHT_ONLY`.
 * `keys()` presses every key in the sequence and then releases them, which is
 * exactly a chord.
 *
 * A name neither table knows is an error: `keys()` would type it as text, so a
 * misspelt `Entr` would put four letters in the field and press nothing.
 */
export function toKeySequence(key: string): string[] {
  // `+` alone, or a trailing `++`, is the plus key itself rather than a separator.
  const parts = key.length > 1 ? key.split(/\+(?!$)/) : [key]
  return parts.map(part => {
    // One character — `a`, `+`, `é` — is typed as itself.
    if ([...part].length === 1) return part
    const mapped = PLAYWRIGHT_ONLY[part]
    if (mapped !== undefined) return mapped
    const code = /^(?:Key([A-Z])|Digit(\d))$/.exec(part)
    if (code !== null) return (code[1] ?? code[2]!).toLowerCase()
    if (Object.hasOwn(WEBDRIVERIO_KEYS, part)) return WEBDRIVERIO_KEYS[part]!
    throw new Error(
      `harnessed: press() does not know the key "${part}"${parts.length > 1 ? ` in "${key}"` : ''}. ` +
        'Use a Playwright key name — Enter, ArrowLeft, Control+a, KeyA, Digit1 — or a single character.',
    )
  })
}
