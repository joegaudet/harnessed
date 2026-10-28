<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ token: string | null }>()

const expired = computed(() => props.token === null || props.token === 'expired')
</script>

<template>
  <section data-testid="page-step-two">
    <h1>Step two</h1>
    <p v-if="expired" data-testid="step-two-expired">That link has expired</p>
    <p v-else data-testid="step-two-token">{{ token }}</p>
  </section>
</template>
