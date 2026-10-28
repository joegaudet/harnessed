<!-- Several instances of one component on one screen — exercises count/nth/map/filter. -->
<script lang="ts">
  import Card from './Card.svelte'
  import type { CardSpec } from './cards'

  let { cards }: { cards: CardSpec[] } = $props()

  let chosen = $state<string | null>(null)
</script>

<div data-testid="card-grid" data-test-card-grid="">
  <h1>Options</h1>
  <h2>Pick one</h2>
  <!-- The key changes when selection does, so choosing REPLACES the DOM node
       rather than mutating it — deliberately, because a resolved-once list that
       keeps reading a detached node reads stale values silently. -->
  {#each cards as card (`${card.label}:${chosen === card.label}`)}
    <Card
      label={card.label}
      hint={card.hint}
      on={chosen === card.label}
      onchoose={() => (chosen = card.label)}
    />
  {/each}
</div>
