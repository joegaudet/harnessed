<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<!--
  The dialog renders OUTSIDE the host subtree, so a scoped query cannot reach it.
  This is what `{ global: true }` exists for. `<Teleport to="body">` is Vue's
  createPortal: the dialog's nodes are direct children of body, with no wrapper.
-->
<template>
  <div data-testid="portal-host" data-test-portal-host="">
    <button type="button" @click="open = true">Open confirm</button>
    <Teleport v-if="open" to="body">
      <div role="dialog" aria-label="Confirm">
        <p data-testid="dialog-body" data-test-dialog-body="">Are you sure?</p>
        <button type="button" @click="open = false">Dismiss</button>
      </div>
    </Teleport>
  </div>
</template>
