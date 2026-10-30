import Route from '@ember/routing/route'
import { service } from '@ember/service'
import type RouterService from '@ember/routing/router-service'

/** The guide has no landing page of its own: start at the introduction. */
export default class IndexRoute extends Route {
  @service declare router: RouterService

  beforeModel() {
    this.router.replaceWith('/getting-started/introduction.md')
  }
}
