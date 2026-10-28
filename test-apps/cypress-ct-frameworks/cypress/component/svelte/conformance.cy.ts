import { mount } from 'cypress/svelte'
import { registerCatalog } from '../catalog'
import type { Stage } from '../catalog'
import StageComponent from './Stage.svelte'

const stage: Stage = {
  mount: () => {
    mount(StageComponent, { props: { stage } })
  },
}

registerCatalog('svelte', stage)
