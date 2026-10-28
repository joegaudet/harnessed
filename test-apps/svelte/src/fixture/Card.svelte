<!-- The host IS the interactive element — exercises `self`. Selection is aria-pressed. -->
<script lang="ts">
  interface Props {
    label: string
    hint?: string | undefined
    on: boolean
    onchoose: () => void
  }

  let { label, hint, on, onchoose }: Props = $props()
</script>

<button type="button" data-testid="card" data-test-card="" aria-pressed={on} onclick={onchoose}>
  <!-- A presence attribute may carry a value; it still matches by name alone. -->
  <span data-testid="card-label" data-test-card-label={label}>{label}</span>
  {#if hint}
    <small data-testid="card-hint" data-test-card-hint="">{hint}</small>
  {/if}
</button>
