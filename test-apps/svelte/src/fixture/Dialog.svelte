<!-- What PortalDialog mounts into document.body. -->
<script lang="ts">
  let { ondismiss }: { ondismiss: () => void } = $props()
</script>

<div role="dialog" aria-label="Confirm">
  <p data-testid="dialog-body" data-test-dialog-body="">Are you sure?</p>
  <button type="button" onclick={ondismiss}>Dismiss</button>
</div>
