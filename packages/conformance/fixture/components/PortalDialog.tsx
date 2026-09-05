import { useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The dialog renders OUTSIDE the host subtree, so a scoped query cannot reach it.
 * This is what `{ global: true }` exists for.
 */
export function PortalDialog() {
  const [open, setOpen] = useState(false)
  return (
    <div data-testid="portal-host">
      <button type="button" onClick={() => setOpen(true)}>
        Open confirm
      </button>
      {open
        ? createPortal(
            <div role="dialog" aria-label="Confirm">
              <p data-testid="dialog-body">Are you sure?</p>
              <button type="button" onClick={() => setOpen(false)}>
                Dismiss
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
