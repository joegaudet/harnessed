// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isVisibleInLayout } from '../src/visible'

/**
 * jsdom computes no layout — every box is empty — so each case gives the
 * elements it cares about a box by hand. That is the one input a real browser
 * would supply; everything else here is the rule under test.
 */
function withBox(element: Element, width = 10, height = 10): Element {
  element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height }) as DOMRect
  return element
}

function mount(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isVisibleInLayout', () => {
  it('is true for an element with a non-empty box', () => {
    const root = mount('<button>Go</button>')
    expect(isVisibleInLayout(withBox(root.querySelector('button')!))).toBe(true)
  })

  it('is false for an element with no box, which is what display: none gives', () => {
    const root = mount('<button>Go</button>')
    expect(isVisibleInLayout(root.querySelector('button')!)).toBe(false)
  })

  it('is false when either dimension is zero', () => {
    const root = mount('<p>a</p><p>b</p>')
    const [wide, tall] = root.querySelectorAll('p')
    expect(isVisibleInLayout(withBox(wide!, 10, 0))).toBe(false)
    expect(isVisibleInLayout(withBox(tall!, 0, 10))).toBe(false)
  })

  it('is false for a box that visibility: hidden hides, inherited or its own', () => {
    const root = mount(
      '<div style="visibility: hidden"><button>Go</button></div><p style="visibility: collapse">x</p>',
    )
    expect(isVisibleInLayout(withBox(root.querySelector('button')!))).toBe(false)
    expect(isVisibleInLayout(withBox(root.querySelector('p')!))).toBe(false)
  })

  it('treats opacity: 0 as visible, as Playwright does: the box is still there', () => {
    const root = mount('<button style="opacity: 0">Go</button>')
    expect(isVisibleInLayout(withBox(root.querySelector('button')!))).toBe(true)
  })

  it('answers display: contents from its children, since it has no box of its own', () => {
    const root = mount(
      '<div id="shown" style="display: contents"><span>a</span></div>' +
        '<div id="empty" style="display: contents"><span>b</span></div>',
    )
    withBox(root.querySelector('#shown span')!)
    expect(isVisibleInLayout(root.querySelector('#shown')!)).toBe(true)
    expect(isVisibleInLayout(root.querySelector('#empty')!)).toBe(false)
  })

  describe('inside a frame', () => {
    function framed(): { frame: HTMLIFrameElement; inner: HTMLElement } {
      const root = mount('<iframe></iframe>')
      const frame = root.querySelector('iframe')!
      const doc = frame.contentDocument!
      doc.body.innerHTML = '<button>Inside</button>'
      return { frame, inner: withBox(doc.querySelector('button')!) as HTMLElement }
    }

    it('is visible when the frame around it is', () => {
      const { frame, inner } = framed()
      withBox(frame)
      expect(isVisibleInLayout(inner)).toBe(true)
    })

    it('is hidden when the frame around it has no box: a hidden frame hides its content', () => {
      const { inner } = framed()
      expect(isVisibleInLayout(inner)).toBe(false)
    })

    it('stops at `home`, crossing only the frames below it', () => {
      const { inner } = framed()
      expect(isVisibleInLayout(inner, inner.ownerDocument)).toBe(true)
    })
  })
})
