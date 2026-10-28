import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Layout the boundingBox specs measure. The frame's border and padding sit
 * between its box and its document, so they are part of what is checked.
 */
export const FRAME = { width: 240, height: 120, border: '3px solid', padding: 4 } as const
export const MARKER = {
  position: 'fixed',
  left: 12,
  top: 34,
  width: 56,
  height: 78,
  pointerEvents: 'none',
} as const
export const FRAMED_MARKER = {
  position: 'fixed',
  left: 5,
  top: 6,
  width: 20,
  height: 10,
  pointerEvents: 'none',
} as const

/**
 * A counter rendered INSIDE a same-origin iframe (no `src` — the only kind jsdom
 * can enter), beside a decoy with the same test id outside it.
 */
export function FramedPanel() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [count, setCount] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setBody(frame.current?.contentDocument?.body ?? null)
  }, [])

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
        style={hidden ? { ...FRAME, display: 'none' } : FRAME}
        // Some engines replace the initial about:blank document when it loads.
        onLoad={event => setBody(event.currentTarget.contentDocument?.body ?? null)}
      />
      {body
        ? createPortal(
            <>
              <div data-testid="counter" data-test-counter="">
                <p data-testid="frame-count" data-test-frame-count="">
                  Clicked {count} times
                </p>
                <button type="button" onClick={() => setCount(c => c + 1)}>
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
            </>,
            body,
          )
        : null}
    </div>
  )
}
