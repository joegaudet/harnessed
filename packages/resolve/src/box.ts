import type { BoundingBox } from '@harnessed-ts/core'

/** A point in a document's viewport, in CSS pixels. */
export interface Point {
  x: number
  y: number
}

/**
 * An element's border box in its own document's viewport, or `null` when it
 * renders no box at all (`display: none`, or anything inside it). Every driver
 * reads `null` as all zeros, which is what Playwright and Puppeteer — whose
 * native boxes are `null` there — are normalised to.
 */
export function boxInOwnDocument(element: Element): BoundingBox | null {
  if (element.getClientRects().length === 0) return null
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

/**
 * Where an iframe's document is drawn, in the iframe's own document: the corner
 * of its content box, inside its border and padding. The same offset Playwright
 * and Puppeteer add when they report a framed element's box.
 */
export function frameOrigin(iframe: Element): Point {
  const { x, y } = iframe.getBoundingClientRect()
  const style = iframe.ownerDocument.defaultView?.getComputedStyle(iframe)
  const px = (value: string | undefined): number => Number.parseFloat(value ?? '') || 0
  return {
    x: x + px(style?.borderLeftWidth) + px(style?.paddingLeft),
    y: y + px(style?.borderTopWidth) + px(style?.paddingTop),
  }
}

/**
 * An element's box relative to the viewport of `home` — the document the
 * driver drives — adding the origin of every same-origin frame crossed on the
 * way up. For drivers that resolve inside the page; under jsdom everything is
 * zeros, because jsdom computes no layout.
 */
export function boundingBoxOf(element: Element, home?: Document): BoundingBox {
  const box = boxInOwnDocument(element)
  if (box === null) return { x: 0, y: 0, width: 0, height: 0 }
  let document = element.ownerDocument
  while (document !== home) {
    // Null at the top, and for a cross-origin parent, which script cannot see into.
    const frame = document.defaultView?.frameElement
    if (frame == null) break
    const origin = frameOrigin(frame)
    box.x += origin.x
    box.y += origin.y
    document = frame.ownerDocument
  }
  return box
}
