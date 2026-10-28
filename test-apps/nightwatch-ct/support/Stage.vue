<script setup lang="ts">
import ConformanceApp from 'test-app-vue/fixture/ConformanceApp.vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * What `browser.mountComponent` mounts for the Vue port: the same shape as
 * support/Stage.ts for React. It renders no fixture until a spec names its view,
 * then mounts the Vue ConformanceApp, which reads its view from the URL at
 * setup — so a new key per view gives it a fresh setup. Vue renders on the next
 * tick, and the catalog's context waits for the fixture's stage either way.
 */
const key = ref<number | null>(null)
let renders = 0

onMounted(() => {
  window.__harnessedShow = search => {
    window.history.replaceState(null, '', `${window.location.pathname}${search}`)
    key.value = ++renders
  }
})
onBeforeUnmount(() => {
  delete window.__harnessedShow
})
</script>

<template>
  <!-- The plugin reports a mount as failed when the root renders no element. -->
  <div data-harnessed-ct="">
    <ConformanceApp v-if="key !== null" :key="key" />
  </div>
</template>
