import { describe, expect, it } from 'vitest'
import { toTestCafeKey } from '../src/keys'

describe('toTestCafeKey', () => {
  it("maps Playwright's key names onto TestCafe's", () => {
    expect(toTestCafeKey('Enter')).toBe('enter')
    expect(toTestCafeKey('Escape')).toBe('esc')
    expect(toTestCafeKey('Insert')).toBe('ins')
    expect(toTestCafeKey('ArrowLeft')).toBe('left')
    expect(toTestCafeKey('PageDown')).toBe('pagedown')
    expect(toTestCafeKey(' ')).toBe('space')
    expect(toTestCafeKey('Space')).toBe('space')
  })

  it('passes a printable character through, case and all', () => {
    expect(toTestCafeKey('a')).toBe('a')
    expect(toTestCafeKey('A')).toBe('A')
    expect(toTestCafeKey('/')).toBe('/')
  })

  it('maps every part of a chord', () => {
    expect(toTestCafeKey('Control+Shift+ArrowLeft')).toBe('ctrl+shift+left')
    expect(toTestCafeKey('Alt+Meta+Backspace')).toBe('alt+meta+backspace')
  })

  it('reads a lone + as the plus key, and Control++ as Control held over it', () => {
    expect(toTestCafeKey('+')).toBe('+')
    expect(toTestCafeKey('Control++')).toBe('ctrl++')
    expect(toTestCafeKey('Shift++')).toBe('shift++')
  })

  it('maps KeyX and DigitN codes onto the character they type', () => {
    expect(toTestCafeKey('KeyA')).toBe('a')
    expect(toTestCafeKey('Control+KeyZ')).toBe('ctrl+z')
    expect(toTestCafeKey('Digit7')).toBe('7')
    expect(toTestCafeKey('Shift+Digit1')).toBe('shift+1')
  })

  it('reads ControlOrMeta as Meta on macOS and Control elsewhere', () => {
    expect(toTestCafeKey('ControlOrMeta+a', 'darwin')).toBe('meta+a')
    expect(toTestCafeKey('ControlOrMeta+a', 'linux')).toBe('ctrl+a')
    expect(toTestCafeKey('ControlOrMeta+a', 'win32')).toBe('ctrl+a')
  })

  it('refuses a key TestCafe cannot press, before anything is sent', () => {
    expect(() => toTestCafeKey('F1')).toThrow('harnessed: press() cannot send "F1" under TestCafe')
    expect(() => toTestCafeKey('NumpadEnter')).toThrow(
      'harnessed: press() cannot send "NumpadEnter" under TestCafe',
    )
    expect(() => toTestCafeKey('Control+F5')).toThrow(
      'harnessed: press() cannot send "Control+F5" under TestCafe',
    )
    expect(() => toTestCafeKey('Shift+Tabb')).toThrow(/cannot send "Shift\+Tabb"/)
  })
})
