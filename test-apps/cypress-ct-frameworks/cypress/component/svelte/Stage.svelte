<!-- What `mount` mounts: nothing, until `stage.render` keys a fresh fixture into it. -->
<script lang="ts">
  import { flushSync, onMount } from 'svelte'
  import ConformanceApp from 'test-app-svelte/fixture/ConformanceApp.svelte'
  import type { Stage } from '../catalog'

  let { stage }: { stage: Stage } = $props()

  let key = $state<number | null>(null)

  onMount(() => {
    stage.render = async next => {
      flushSync(() => (key = next))
    }
    return () => {
      stage.render = undefined
    }
  })
</script>

{#if key !== null}
  {#key key}
    <ConformanceApp />
  {/key}
{/if}
