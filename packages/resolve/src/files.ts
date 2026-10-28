/**
 * The file input an upload sets: the element itself, or the control of a
 * `<label>` — user-event's and Playwright's rule both. Anything else comes back
 * described as markup, for core's `checkFileTarget` to refuse in one wording.
 */
export function fileInputOf(element: Element): HTMLInputElement | string {
  const target =
    element.localName === 'label' ? (element as HTMLLabelElement).control : (element as Element)
  if (target === null) return '<label> with no control'
  if (target.localName !== 'input') return `<${target.localName}>`
  const input = target as HTMLInputElement
  return input.type === 'file' ? input : `<input type="${input.type}">`
}
