import EmberRouter from '@embroider/router'
import { properLinks } from 'ember-primitives/proper-links'
import { addRoutes } from 'kolay'
import config from 'docs-app/config/environment'

/**
 * A pattern for paths outside the guide's rootURL, like the project site it is served
 * under. Kolay's catch-all route would claim them, so the browser must follow them.
 */
export function outsideRoot(rootURL: string): string {
  if (rootURL === '/') return '(?!)'
  return `^(?!${rootURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`
}

/** Plain <a href> links (like the ones in markdown) become router transitions. */
@properLinks({ ignore: [outsideRoot(config.rootURL)] })
export default class Router extends EmberRouter {
  location = config.locationType
  rootURL = config.rootURL
}

Router.map(function () {
  addRoutes(this)
})
