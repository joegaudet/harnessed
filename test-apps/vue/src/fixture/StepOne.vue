<script setup lang="ts">
defineEmits<{ next: [] }>()
</script>

<template>
  <section data-testid="page-step-one">
    <h1>Step one</h1>
    <button type="button" @click="$emit('next')">Continue</button>
  </section>
</template>
