import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { render } from 'solid-js/web'

/**
 * Layout the boundingBox specs measure, as in the React fixture. The frame's
 * border and padding sit between its box and its document. Solid sets style
 * objects property by property, so names are CSS's and units are written out.
 */
const FRAME: JSX.CSSProperties = {
  width: '240px',
  height: '120px',
  border: '3px solid',
  padding: '4px',
}
const MARKER: JSX.CSSProperties = {
  position: 'fixed',
  left: '12px',
  top: '34px',
  width: '56px',
  height: '78px',
  'pointer-events': 'none',
}
const FRAMED_MARKER: JSX.CSSProperties = {
  position: 'fixed',
  left: '5px',
  top: '6px',
  width: '20px',
  height: '10px',
  'pointer-events': 'none',
}

/**
 * What renders inside the frame. Its button listens with `on:click`, a listener
 * on the element itself: Solid delegates `onClick` to the main document, which
 * a click inside another document never reaches.
 */
function Framed() {
  const [count, setCount] = createSignal(0)
  return (
    <>
      <div data-testid="counter" data-test-counter="">
        <p data-testid="frame-count" data-test-frame-count="">
          Clicked {count()} times
        </p>
        <button type="button" on:click={() => setCount(c => c + 1)}>
          Add one
        </button>
        <label>
          Note <input />
        </label>
      </div>
      <p data-testid="frame-toast" data-test-frame-toast="">
        Toast inside the frame
      </p>
      <div data-testid="framed-box" style={FRAMED_MARKER} />
    </>
  )
}

/**
 * A counter rendered INSIDE a same-origin iframe (no `src` — the only kind jsdom
 * can enter), beside a decoy with the same test id outside it.
 *
 * The framed content is rendered into the frame's body with `render()`, not
 * <Portal mount={body}>: Portal's wrapper <div> would sit inside the frame's
 * body, and the frame's contents are part of the parity tree.
 */
export function FramedPanel() {
  let frame: HTMLIFrameElement | undefined
  const [body, setBody] = createSignal<HTMLElement | null>(null)
  const [hidden, setHidden] = createSignal(false)

  onMount(() => setBody(frame?.contentDocument?.body ?? null))

  createEffect(() => {
    const target = body()
    if (target === null) return
    onCleanup(render(() => <Framed />, target))
  })

  return (
    <div data-testid="frame-host" data-test-frame-host="">
      <p data-testid="frame-count" data-test-frame-count="">
        decoy outside the frame
      </p>
      <p data-testid="frame-toast" data-test-frame-toast="">
        decoy toast outside the frame
      </p>
      {/* Fixed, so its box is known in the viewport; it takes no clicks. */}
      <div data-testid="box" style={MARKER} />
      <button type="button" onClick={() => setHidden(true)}>
        Hide frame
      </button>
      <iframe
        ref={frame}
        data-testid="framed"
        data-test-framed=""
        title="Framed counter"
        style={hidden() ? { ...FRAME, display: 'none' } : FRAME}
        // Some engines replace the initial about:blank document when it loads.
        onLoad={event => setBody(event.currentTarget.contentDocument?.body ?? null)}
      />
    </div>
  )
}
