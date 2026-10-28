import { createSignal, Show } from 'solid-js'
import { Portal } from 'solid-js/web'

/**
 * The dialog renders OUTSIDE the host subtree, so a scoped query cannot reach it.
 * This is what `{ global: true }` exists for.
 *
 * Solid's <Portal> mounts into a wrapper <div> it appends to `document.body`, so
 * the dialog is `body > div > [role=dialog]`, not React's `body > [role=dialog]`.
 * The parity tree covers only the stage, and the specs reach the dialog by role,
 * so neither depends on that wrapper — and a `global` selector must not either.
 */
export function PortalDialog() {
  const [open, setOpen] = createSignal(false)
  return (
    <div data-testid="portal-host" data-test-portal-host="">
      <button type="button" onClick={() => setOpen(true)}>
        Open confirm
      </button>
      <Show when={open()}>
        <Portal>
          <div role="dialog" aria-label="Confirm">
            <p data-testid="dialog-body" data-test-dialog-body="">
              Are you sure?
            </p>
            <button type="button" onClick={() => setOpen(false)}>
              Dismiss
            </button>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
