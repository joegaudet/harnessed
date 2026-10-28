import { Location } from '@angular/common'
import { Router, ROUTES } from '@angular/router'
import { registerNavigation } from '@harnessed-ts/core'
import type { EnvConfig } from '@harnessed-ts/core'
import { waitFor as waitForCondition } from '@testing-library/dom'
import { ANGULAR_DRIVER } from './driver-id'
import type { AngularEnv } from './env'
import { injectorOf, settle } from './stable'

interface Routing {
  router: Router
  location: Location
}

/**
 * The app's router, or the standard refusal. A component rendered on its own
 * has no router to drive — the Angular shape of a jsdom test — and a page there
 * constructs and reads, but cannot navigate.
 */
function routing(env: EnvConfig): Routing {
  const injector = injectorOf(env as AngularEnv)
  // Not `get(Router, null)`: the Router is provided in root, so it always
  // resolves — to one with no routes, which matches no URL. The ROUTES token is
  // what `provideRouter()` and `RouterModule.forRoot()` add.
  if (injector.get(ROUTES, null) === null) {
    throw new Error(
      `harnessed: the "${ANGULAR_DRIVER}" driver cannot navigate without a Router, so a page ` +
        'cannot navigate with it. Provide one to the app or the TestBed (provideRouter()), or ' +
        'reach the page by rendering it.',
    )
  }
  return { router: injector.get(Router), location: injector.get(Location) }
}

/**
 * The router's URL, made absolute. `Location.path()` is the truth, not
 * `window.location`: TestBed swaps in a mock platform location, so a test's
 * navigations never reach the address bar. Absolute because a page reads
 * `pathname` and `searchParams` off it with `new URL()`.
 *
 * There is no URL before the router's first navigation — TestBed performs
 * none of its own. Reading that as `/` would let `assertPathname('/')` pass
 * before anything navigated, so it refuses.
 */
function absolute(env: EnvConfig): string {
  const { router, location } = routing(env)
  if (!router.navigated) {
    throw new Error(
      'harnessed: the router has not navigated yet. Call a page’s goto(), or ' +
        'router.navigateByUrl(), first.',
    )
  }
  return new URL(location.path(), window.location.origin).href
}

/** Navigation through the app's Router, wherever one is provided. */
registerNavigation(ANGULAR_DRIVER, {
  async goto(env, url) {
    const { router } = routing(env)
    // Resolves once the navigation ends; whenStable() then waits out the
    // change detection it scheduled, so the destination is on screen.
    await router.navigateByUrl(url)
    await settle(env as AngularEnv)
  },
  currentUrl(env) {
    return absolute(env)
  },
  async waitForUrl(env, matches, timeout) {
    // Outside the retry loop: no router is a refusal, not something to wait out.
    absolute(env)
    await waitForCondition(
      () => {
        if (!matches(new URL(absolute(env)))) throw new Error(`still at ${absolute(env)}`)
      },
      { timeout },
    )
    // The URL changes before the destination has rendered.
    await settle(env as AngularEnv)
  },
})
