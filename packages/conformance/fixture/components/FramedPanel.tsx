import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
    <div data-testid="frame-host">
      <p data-testid="frame-count">decoy outside the frame</p>
      <p data-testid="frame-toast">decoy toast outside the frame</p>
      <button type="button" onClick={() => setHidden(true)}>
        Hide frame
      </button>
      <iframe
        ref={frame}
        data-testid="framed"
        title="Framed counter"
        style={hidden ? { display: 'none' } : undefined}
        // Some engines replace the initial about:blank document when it loads.
        onLoad={event => setBody(event.currentTarget.contentDocument?.body ?? null)}
      />
      {body
        ? createPortal(
            <>
              <div data-testid="counter">
                <p data-testid="frame-count">Clicked {count} times</p>
                <button type="button" onClick={() => setCount(c => c + 1)}>
                  Add one
                </button>
                <label>
                  Note <input />
                </label>
              </div>
              <p data-testid="frame-toast">Toast inside the frame</p>
            </>,
            body,
          )
        : null}
    </div>
  )
}
