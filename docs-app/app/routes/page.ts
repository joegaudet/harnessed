import Route from '@ember/routing/route'
import { handlePotentialIndexVisit } from 'kolay'
import type Transition from '@ember/routing/transition'

export default class PageRoute extends Route {
  beforeModel(transition: Transition) {
    handlePotentialIndexVisit(this, transition)
  }
}
