import { viewSearch } from '@harnessed-ts/conformance'
import { App } from '@harnessed-ts/conformance/fixture'
import { dom } from '@harnessed-ts/dom'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { afterEach, it } from 'vitest'
import { demo } from '../src/demo'
import { RECORDING, writeJson } from '../src/raw'
import { sleep, STEP_PAUSE_MS, stepper, TAIL_MS } from '../src/timeline'
import type { Timeline } from '../src/timeline'

afterEach(cleanup)

interface Snapshot {
  at: number
  html: string
}

/**
 * The body's markup as a screen would show it: live form state written back into
 * attributes (a typed value lives in a property, which `innerHTML` alone would
 * not show), and each iframe's own document inlined as its `srcdoc`.
 */
function serialize(body: HTMLElement): string {
  const copy = body.cloneNode(true) as HTMLElement
  const fields = 'input, select, textarea, option, iframe'
  const live = body.querySelectorAll(fields)
  const copied = copy.querySelectorAll(fields)
  // Tag names, not instanceof: an iframe's nodes come from another window.
  live.forEach((node, i) => {
    const target = copied[i]!
    if (node.tagName === 'INPUT') {
      const input = node as HTMLInputElement
      if (input.type === 'checkbox' || input.type === 'radio') {
        target.toggleAttribute('checked', input.checked)
      } else {
        target.setAttribute('value', input.value)
      }
    } else if (node.tagName === 'TEXTAREA') {
      target.textContent = (node as HTMLTextAreaElement).value
    } else if (node.tagName === 'OPTION') {
      target.toggleAttribute('selected', (node as HTMLOptionElement).selected)
    } else if (node.tagName === 'IFRAME') {
      const inner = (node as HTMLIFrameElement).contentDocument?.body
      if (inner) target.setAttribute('srcdoc', `<!doctype html><body>${serialize(inner)}</body>`)
    }
  })
  return copy.innerHTML
}

/** How often the replay looks at the DOM: finer than the GIF's 10 frames a second. */
const SNAPSHOT_MS = 25

/**
 * jsdom has no screen to record, so this keeps what it rendered instead: the
 * body's markup, every few milliseconds, whenever it changed.
 */
function filmDom(started: number): { snapshots: Snapshot[]; stop(): void } {
  const snapshots: Snapshot[] = []
  const take = () => {
    const html = serialize(document.body)
    if (snapshots.at(-1)?.html !== html) snapshots.push({ at: Date.now() - started, html })
  }
  take()
  const timer = setInterval(take, SNAPSHOT_MS)
  return {
    snapshots,
    stop() {
      clearInterval(timer)
      take()
    },
  }
}

it('runs the demo under React Testing Library, in jsdom', { timeout: 60_000 }, async () => {
  const started = Date.now()
  const film = RECORDING ? filmDom(started) : null
  const { steps, step } = stepper({
    now: () => Date.now() - started,
    pauseMs: RECORDING ? STEP_PAUSE_MS : 0,
  })

  await demo({
    async show(view) {
      // One view at a time, as a browser shows one page at a time.
      cleanup()
      window.history.pushState({}, '', `/${viewSearch(view)}`)
      const { baseElement } = render(createElement(App))
      // A typing delay while recording, the way the browser runs use slowMo.
      const user = userEvent.setup(RECORDING ? { delay: 50 } : {})
      return dom({ user, container: baseElement })
    },
    step,
  })

  if (film) {
    const end = Date.now() - started
    await sleep(TAIL_MS)
    film.stop()
    const timeline: Timeline = { env: 'rtl', steps, end }
    writeJson('rtl', 'timeline.json', timeline)
    writeJson('rtl', 'snapshots.json', film.snapshots)
  }
})
