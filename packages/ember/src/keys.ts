import { triggerEvent, triggerKeyEvent, typeIn } from '@ember/test-helpers'

type Editable = HTMLInputElement | HTMLTextAreaElement

function isEditable(element: Element): element is Editable {
  const tag = element.localName
  return (tag === 'input' || tag === 'textarea') && !(element as Editable).readOnly
}

/**
 * A key press that does what a browser would, which `triggerKeyEvent` alone
 * does not: it dispatches the events, but a printable key never reaches the
 * value and Backspace deletes nothing. Playwright's `press` does both, so this
 * covers the keys a harness realistically presses — printable characters,
 * Backspace, Delete — and dispatches the rest as events only.
 */
export async function press(element: Element, key: string): Promise<void> {
  if (key.length === 1 && isEditable(element)) {
    // typeIn fires keydown, keypress, input and keyup around the insertion.
    await typeIn(element, key)
    return
  }

  await triggerKeyEvent(element, 'keydown', key)
  if ((key === 'Backspace' || key === 'Delete') && isEditable(element)) {
    const { value } = element
    const start = element.selectionStart ?? value.length
    const end = element.selectionEnd ?? value.length
    const [from, to] =
      start !== end ? [start, end] : key === 'Backspace' ? [start - 1, start] : [start, start + 1]
    if (from >= 0 && to <= value.length) {
      element.value = value.slice(0, from) + value.slice(to)
      element.setSelectionRange(from, from)
      await triggerEvent(element, 'input')
    }
  }
  await triggerKeyEvent(element, 'keyup', key)
}
