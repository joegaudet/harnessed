/**
 * Whether an element is visible by layout — Playwright's definition, for drivers
 * that run in a real browser beside the page (Vitest browser mode, Ember, Cypress).
 * jsdom computes no layout, so the dom driver cannot use this and reads computed
 * style instead.
 *
 * Visible means a non-empty box that `visibility` does not hide. `display: none`
 * anywhere above gives an empty box, so it needs no check of its own. Opacity
 * does not count: a transparent box is still there to click, and Playwright
 * reports it visible.
 *
 * Inside a frame, the iframe has to be visible too — a hidden frame hides its
 * content. The walk crosses frames up to `home` (by default, every reachable
 * one), so a driver passes its own document to stop at the frames its scope
 * actually entered.
 */
export function isVisibleInLayout(element: Element, home?: Document): boolean {
  if (!isVisibleInOwnDocument(element)) return false
  const document = element.ownerDocument
  if (document === home) return true
  // Null at the top, and for a cross-origin parent, which script cannot see into.
  const frame = document.defaultView?.frameElement
  return frame == null || isVisibleInLayout(frame, home)
}

function isVisibleInOwnDocument(element: Element): boolean {
  const view = element.ownerDocument.defaultView
  // A node with no window is detached from any rendering.
  if (view == null) return false
  const style = view.getComputedStyle(element)
  // `display: contents` draws no box of its own, so it is as visible as what it
  // contains.
  if (style.display === 'contents') {
    return [...element.children].some(child => isVisibleInOwnDocument(child))
  }
  if (style.visibility !== 'visible') return false
  const box = element.getBoundingClientRect()
  return box.width > 0 && box.height > 0
}
