import { Key } from 'webdriverio'

/**
 * Playwright's key names — `Enter`, `ArrowLeft`, `Control+a` — as the sequence
 * WebdriverIO's `keys()` takes. WebdriverIO already knows most names
 * (`Enter`, `Backspace`, `Shift`, `F1`…); this covers the rest: a `+` chord,
 * `KeyA`/`Digit1` codes, and `ControlOrMeta`. `keys()` presses every key in the
 * sequence and then releases them, which is exactly a chord.
 */
export function toKeySequence(key: string): string[] {
  // `+` alone, or a trailing `++`, is the plus key itself rather than a separator.
  const parts = key.length > 1 ? key.split(/\+(?!$)/) : [key]
  return parts.map(part => {
    if (part === 'ControlOrMeta') return Key.Ctrl
    const code = /^(?:Key([A-Z])|Digit(\d))$/.exec(part)
    if (code !== null) return (code[1] ?? code[2]!).toLowerCase()
    return part
  })
}
