<script lang="ts">
  let { token }: { token: string | null } = $props()

  const expired = $derived(token === null || token === 'expired')
</script>

<section data-testid="page-step-two">
  <h1>Step two</h1>
  {#if expired}
    <p data-testid="step-two-expired">That link has expired</p>
  {:else}
    <p data-testid="step-two-token">{token}</p>
  {/if}
</section>
