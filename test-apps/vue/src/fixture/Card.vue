<script setup lang="ts">
defineProps<{ label: string; hint?: string | undefined; on: boolean }>()
defineEmits<{ choose: [] }>()
</script>

<!-- The host IS the interactive element — exercises `self`. Selection is aria-pressed. -->
<template>
  <button
    type="button"
    data-testid="card"
    data-test-card=""
    :aria-pressed="on"
    @click="$emit('choose')"
  >
    <!-- A presence attribute may carry a value; it still matches by name alone. -->
    <span data-testid="card-label" :data-test-card-label="label">{{ label }}</span>
    <small v-if="hint" data-testid="card-hint" data-test-card-hint="">{{ hint }}</small>
  </button>
</template>
