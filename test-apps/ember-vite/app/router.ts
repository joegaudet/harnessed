import EmberRouter from '@embroider/router'
import config from 'test-app-ember-vite/config/environment'

export default class Router extends EmberRouter {
  location = config.locationType
  rootURL = config.rootURL
}

// Every URL renders the fixture, which reads the path and query itself — the
// way the React fixture reads window.location.
Router.map(function () {
  this.route('fixture', { path: '/*path' })
})
