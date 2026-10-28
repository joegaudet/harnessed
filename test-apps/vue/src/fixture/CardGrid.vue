<script setup lang="ts">
import { ref } from 'vue'
import Card from './Card.vue'
import type { CardSpec } from './cards'

defineProps<{ cards: CardSpec[] }>()

const chosen = ref<string | null>(null)
</script>

<!-- Several instances of one component on one screen — exercises count/nth/map/filter. -->
<template>
  <div data-testid="card-grid" data-test-card-grid="">
    <h1>Options</h1>
    <h2>Pick one</h2>
    <!-- The key changes when selection does, so choosing REPLACES the DOM node
         rather than mutating it — deliberately, because a resolved-once list that
         keeps reading a detached node reads stale values silently. -->
    <Card
      v-for="card in cards"
      :key="`${card.label}:${chosen === card.label}`"
      :label="card.label"
      :hint="card.hint"
      :on="chosen === card.label"
      @choose="chosen = card.label"
    />
  </div>
</template>
