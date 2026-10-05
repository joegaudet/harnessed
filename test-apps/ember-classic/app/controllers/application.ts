import Controller from '@ember/controller'
import { service } from '@ember/service'
import type RouterService from '@ember/routing/router-service'

export default class ApplicationController extends Controller {
  @service declare router: RouterService

  /** The router's URL, which the fixture reads the way the React one reads window.location. */
  get url() {
    return this.router.currentURL ?? '/'
  }
}
