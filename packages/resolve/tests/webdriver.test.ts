import { frame, role, StrictModeViolation, testId } from '@harnessed-ts/core'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
// The built entry, as a driver loads it: it finds the injectable build beside it.
import { callPage, classicScript, FrameAbsent, walk } from '../dist/webdriver.js'
import type { PageScriptArgs, WebDriverLike, WebDriverSite } from '../src/webdriver'

/**
 * The shared WebDriver code against a fake client: jsdom windows stand in for
 * the documents a session works in, and the classic Execute Script body runs in
 * them as a WebDriver would run it. `pnpm build` must run first.
 */

/** A jsdom window or a frame's: anything with the page's own `eval`. */
type PageWindow = object

interface FakeSite extends WebDriverSite {
  readonly window: PageWindow
}

interface Recorded {
  injected: number
  entered: number
  left: number
  urls: string[]
}

function session(html: string): {
  client: WebDriverLike<FakeSite, Element>
  recorded: Recorded
  window: { readonly document: Document }
} {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'outside-only',
    url: 'http://fixture.test/start',
  })
  const recorded: Recorded = { injected: 0, entered: 0, left: 0, urls: [] }
  // As WebDriver runs a script body: a function of the call's arguments.
  const evaluate = (window: PageWindow, body: string, args: readonly unknown[]): unknown => {
    const script: unknown = Reflect.apply(Reflect.get(window, 'eval'), window, [
      `(function () {${body}\n})`,
    ])
    if (typeof script !== 'function') throw new Error('the body did not evaluate to a function')
    return Reflect.apply(script, undefined, args)
  }
  const client: WebDriverLike<FakeSite, Element> = {
    top: () => ({ window: dom.window, top: true, origin: { x: 0, y: 0 } }),
    run: async (site, args: PageScriptArgs) => evaluate(site.window, classicScript(), args),
    async inject(site, code) {
      recorded.injected++
      evaluate(site.window, code, [])
    },
    // jsdom hands back the element itself, as selenium-webdriver hands back a WebElement.
    element: async (_site, ref) => ref as object as Element,
    async enterFrame(_site, iframe, origin) {
      recorded.entered++
      const window = (iframe as HTMLIFrameElement).contentWindow
      if (window === null) throw new Error('no frame window')
      return { window, top: false, origin }
    },
    async leaveFrames() {
      recorded.left++
    },
    sawUrl: url => recorded.urls.push(url),
  }
  return { client, recorded, window: dom.window }
}

/** Fills a same-document iframe, which jsdom gives a window of its own. */
function fillFrame(window: { readonly document: Document }, html: string): void {
  const iframe = window.document.querySelector('iframe')!
  iframe.contentDocument!.body.innerHTML = html
}

describe('@harnessed-ts/resolve/webdriver', () => {
  it('injects the resolver into a document that lacks it, once', async () => {
    const { client, recorded } = session('<button>One</button><button>Two</button>')
    const site = client.top()
    await expect(callPage(client, site, 'count', [], role('button'), 0)).resolves.toBe(2)
    await expect(callPage(client, site, 'count', [], role('button'), 0)).resolves.toBe(2)
    expect(recorded.injected).toBe(1)
  })

  it("hands back the page's strict violation as core's own class", async () => {
    const { client } = session('<button>One</button><button>Two</button>')
    const error = await callPage(client, client.top(), 'text', [], role('button'), 0).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(StrictModeViolation)
    expect((error as Error).message).toMatch(/^harnessed: strict mode violation — 2 nodes match/)
  })

  it('reports the top-level URL, and only from the top-level document', async () => {
    const { client, recorded, window } = session('<iframe data-testid="f"></iframe>')
    fillFrame(window, '<p>Inside</p>')
    await walk(client, [frame(testId('f'))], { waiting: false, timeout: 0 }, (site, rest) =>
      callPage(client, site, 'count', rest, { type: 'text', text: 'Inside' }, 0),
    )
    expect(recorded.urls).toEqual(['http://fixture.test/start'])
  })

  it('enters each frame link, runs the rest inside, and leaves once', async () => {
    const { client, recorded, window } = session('<iframe data-testid="f"></iframe>')
    fillFrame(window, '<p data-testid="in">Inside</p>')
    const text = await walk(
      client,
      [frame(testId('f'))],
      { waiting: true, timeout: 200 },
      (site, rest, remaining) => callPage(client, site, 'text', rest, testId('in'), remaining()),
    )
    expect(text).toBe('Inside')
    expect(recorded).toMatchObject({ entered: 1, left: 1 })
  })

  it('hands each iframe to onFrame with what the page says about it', async () => {
    const { client, window } = session('<iframe data-testid="f"></iframe>')
    fillFrame(window, '<p>Inside</p>')
    const seen: unknown[] = []
    await walk(
      client,
      [frame(testId('f'))],
      { waiting: false, timeout: 0, onFrame: async (iframe, info) => void seen.push(iframe, info) },
      async () => undefined,
    )
    expect(seen[0]).toBe(window.document.querySelector('iframe'))
    // jsdom lays nothing out, so no box: not visible.
    expect(seen[1]).toEqual({ visible: false })
  })

  it('leaves the frames it entered when the operation fails', async () => {
    const { client, recorded, window } = session('<iframe data-testid="f"></iframe>')
    fillFrame(window, '<p>Inside</p>')
    await expect(
      walk(client, [frame(testId('f'))], { waiting: false, timeout: 0 }, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(recorded).toMatchObject({ entered: 1, left: 1 })
  })

  it('answers a missing frame at once in a non-waiting walk, entering nothing', async () => {
    const { client, recorded } = session('<p>No frame here</p>')
    await expect(
      walk(client, [frame(testId('f'))], { waiting: false, timeout: 0 }, async () => 'reached'),
    ).rejects.toBeInstanceOf(FrameAbsent)
    expect(recorded).toMatchObject({ entered: 0, left: 0 })
  })

  it('refuses a frame link on anything but an iframe, in the resolver’s words', async () => {
    const { client } = session('<div data-testid="f"></div>')
    await expect(
      walk(client, [frame(testId('f'))], { waiting: false, timeout: 0 }, async () => 'reached'),
    ).rejects.toMatchObject({ name: 'FrameEntryError' })
  })

  it('answers visible with the match count, without waiting', async () => {
    const { client } = session('<button>One</button><button>Two</button>')
    await expect(callPage(client, client.top(), 'visible', [], role('button'), 0)).resolves.toEqual(
      { count: 2, visible: false },
    )
    await expect(callPage(client, client.top(), 'visible', [], role('link'), 0)).resolves.toEqual({
      count: 0,
      visible: false,
    })
  })
})
