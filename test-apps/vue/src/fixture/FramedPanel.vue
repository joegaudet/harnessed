<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

/**
 * Layout the boundingBox specs measure, as in the React fixture. The frame's
 * border and padding sit between its box and its document. Vue adds no `px` to
 * numbers in a style object, so the units are written out.
 */
const FRAME = { width: '240px', height: '120px', border: '3px solid', padding: '4px' }
const MARKER = {
  position: 'fixed',
  left: '12px',
  top: '34px',
  width: '56px',
  height: '78px',
  pointerEvents: 'none',
} as const
const FRAMED_MARKER = {
  position: 'fixed',
  left: '5px',
  top: '6px',
  width: '20px',
  height: '10px',
  pointerEvents: 'none',
} as const

const frame = ref<HTMLIFrameElement | null>(null)
const body = ref<HTMLElement | null>(null)
const count = ref(0)
const hidden = ref(false)

const frameStyle = computed(() => (hidden.value ? { ...FRAME, display: 'none' } : FRAME))

onMounted(() => {
  body.value = frame.value?.contentDocument?.body ?? null
})

// Some engines replace the initial about:blank document when it loads.
function loaded(event: Event) {
  body.value = (event.currentTarget as HTMLIFrameElement).contentDocument?.body ?? null
}
</script>

<!--
  A counter rendered INSIDE a same-origin iframe (no `src` — the only kind jsdom
  can enter), beside a decoy with the same test id outside it. A Teleport to an
  element of another document is Vue's createPortal into the frame's body.
-->
<template>
  <div data-testid="frame-host" data-test-frame-host="">
    <p data-testid="frame-count" data-test-frame-count="">decoy outside the frame</p>
    <p data-testid="frame-toast" data-test-frame-toast="">decoy toast outside the frame</p>
    <!-- Fixed, so its box is known in the viewport; it takes no clicks. -->
    <div data-testid="box" :style="MARKER" />
    <button type="button" @click="hidden = true">Hide frame</button>
    <iframe
      ref="frame"
      data-testid="framed"
      data-test-framed=""
      title="Framed counter"
      :style="frameStyle"
      @load="loaded"
    />
    <Teleport v-if="body" :to="body">
      <div data-testid="counter" data-test-counter="">
        <p data-testid="frame-count" data-test-frame-count="">Clicked {{ count }} times</p>
        <button type="button" @click="count++">Add one</button>
        <label>Note <input /></label>
      </div>
      <p data-testid="frame-toast" data-test-frame-toast="">Toast inside the frame</p>
      <div data-testid="framed-box" :style="FRAMED_MARKER" />
    </Teleport>
  </div>
</template>
