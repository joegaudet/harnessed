import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A counter rendered INSIDE an iframe's document, beside a decoy with the same
 * test id outside it. Scoped queries cannot cross a document boundary in either
 * driver, so reaching the counter is what `frame()` exists for.
 *
 * Same-origin (no `src`), which is the only kind a jsdom driver can enter.
 */
export function FramedPanel() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    setBody(frame.current?.contentDocument?.body ?? null)
  }, [])

  return (
    <div data-testid="frame-host">
      <p data-testid="frame-count">decoy outside the frame</p>
      <iframe ref={frame} data-testid="framed" title="Framed counter" />
      {body
        ? createPortal(
            <div data-testid="counter">
              <p data-testid="frame-count">Clicked {count} times</p>
              <button type="button" onClick={() => setCount(c => c + 1)}>
                Add one
              </button>
            </div>,
            body,
          )
        : null}
    </div>
  )
}
