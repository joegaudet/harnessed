import { describe, expect, it } from 'vitest'
import { toKeySequence } from '../src/keys'

describe('toKeySequence', () => {
  it("maps Playwright's key names onto WebDriver's key code points", () => {
    expect(toKeySequence('Enter')).toEqual([''])
    expect(toKeySequence('Backspace')).toEqual([''])
    expect(toKeySequence('Escape')).toEqual([''])
    expect(toKeySequence('ArrowLeft')).toEqual([''])
    expect(toKeySequence('PageDown')).toEqual([''])
    expect(toKeySequence('Delete')).toEqual([''])
    expect(toKeySequence('Space')).toEqual([' '])
  })

  it('numbers the function and numpad keys from their first code point', () => {
    expect(toKeySequence('F1')).toEqual([''])
    expect(toKeySequence('F12')).toEqual([''])
    expect(toKeySequence('Numpad0')).toEqual([''])
    expect(toKeySequence('Numpad9')).toEqual([''])
  })

  it('passes a printable character through, case and all', () => {
    expect(toKeySequence('a')).toEqual(['a'])
    expect(toKeySequence('A')).toEqual(['A'])
    expect(toKeySequence('é')).toEqual(['é'])
    expect(toKeySequence(' ')).toEqual([' '])
  })

  it('splits a chord into the keys held, in order', () => {
    expect(toKeySequence('Shift+Tab')).toEqual(['', ''])
    expect(toKeySequence('Control+Shift+ArrowLeft')).toEqual(['', '', ''])
  })

  it('reads a lone + as the plus key, and Control++ as Control held over it', () => {
    expect(toKeySequence('+')).toEqual(['+'])
    expect(toKeySequence('Control++')).toEqual(['', '+'])
  })

  it('maps KeyX and DigitN codes, and code names, onto the character they type', () => {
    expect(toKeySequence('KeyA')).toEqual(['a'])
    expect(toKeySequence('Shift+KeyA')).toEqual(['', 'a'])
    expect(toKeySequence('Digit7')).toEqual(['7'])
    expect(toKeySequence('Minus')).toEqual(['-'])
    expect(toKeySequence('Slash')).toEqual(['/'])
  })

  it('tells the left and right modifiers apart', () => {
    expect(toKeySequence('ShiftLeft')).toEqual([''])
    expect(toKeySequence('ShiftRight')).toEqual([''])
    expect(toKeySequence('ControlRight')).toEqual([''])
  })

  it('reads ControlOrMeta by platform: Meta on macOS, Control elsewhere', () => {
    expect(toKeySequence('ControlOrMeta+a', 'darwin')).toEqual(['', 'a'])
    expect(toKeySequence('ControlOrMeta+a', 'linux')).toEqual(['', 'a'])
    expect(toKeySequence('ControlOrMeta+a', 'win32')).toEqual(['', 'a'])
  })

  it('refuses a key name it does not know, naming it and the chord', () => {
    expect(() => toKeySequence('Entr')).toThrow(/does not know the key "Entr"\./)
    expect(() => toKeySequence('Control+Entr')).toThrow(/"Entr" in "Control\+Entr"/)
  })
})
