import { mount } from 'cypress/vue'
import ConformanceApp from 'test-app-vue/fixture/ConformanceApp.vue'
import { defineComponent, h, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { registerCatalog } from '../catalog'
import type { Stage } from '../catalog'

const stage: Stage = {
  mount: () => {
    mount(StageComponent)
  },
}

/** What `mount` mounts: nothing, until `stage.render` keys a fresh fixture into it. */
const StageComponent = defineComponent({
  setup() {
    const key = ref<number | null>(null)
    onMounted(() => {
      stage.render = async next => {
        key.value = next
        await nextTick()
      }
    })
    onUnmounted(() => {
      stage.render = undefined
    })
    return () => (key.value === null ? null : h(ConformanceApp, { key: key.value }))
  },
})

registerCatalog('vue', stage)
