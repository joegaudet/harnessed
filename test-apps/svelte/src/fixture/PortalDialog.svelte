<!--
  The dialog renders OUTSIDE the host subtree, so a scoped query cannot reach it.
  This is what `{ global: true }` exists for. Svelte has no portal, so the dialog
  is its own component, mounted straight into document.body (no wrapper) while
  `open` holds, and unmounted by the effect's teardown.
-->
<script lang="ts">
  import { mount, unmount } from 'svelte'
  import Dialog from './Dialog.svelte'

  let open = $state(false)

  $effect(() => {
    if (!open) return
    const dialog = mount(Dialog, {
      target: document.body,
      props: { ondismiss: () => (open = false) },
    })
    return () => {
      void unmount(dialog)
    }
  })
</script>

<div data-testid="portal-host" data-test-portal-host="">
  <button type="button" onclick={() => (open = true)}>Open confirm</button>
</div>
