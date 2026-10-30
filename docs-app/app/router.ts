import EmberRouter from '@embroider/router'
import { properLinks } from 'ember-primitives/proper-links'
import { addRoutes } from 'kolay'
import config from 'docs-app/config/environment'

/** Plain <a href> links (like the ones in markdown) become router transitions. */
@properLinks
export default class Router extends EmberRouter {
  location = config.locationType
  rootURL = config.rootURL
}

Router.map(function () {
  addRoutes(this)
})
