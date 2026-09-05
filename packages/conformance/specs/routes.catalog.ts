import assert from 'node:assert/strict'
import { registerDriver } from '@harnessed/core'
import type { EnvConfig, Query } from '@harnessed/core'
import { NeverReadyRoute } from '../fixture/harnesses/routes/never-ready.route'
import { RepeatedParamRoute } from '../fixture/harnesses/routes/repeated-param.route'
import { StepOneRoute } from '../fixture/harnesses/routes/step-one.route'
import { StepTwoRoute } from '../fixture/harnesses/routes/step-two.route'

export interface RouteCtx {
  /**
   * An env for a driver that can navigate. The suite never builds one itself —
   * that would mean importing a concrete driver, and this package must stay
   * installable by an author whose driver is neither of the built-in two.
   */
  readonly env: EnvConfig
}

export interface RouteSpec {
  name: string
  run(ctx: RouteCtx): Promise<void>
}

/** Route behaviour is a URL, a navigation, and a readiness check. Playwright only. */
export const routeSpecs: RouteSpec[] = [
  {
    name: 'a route with no declared params navigates with no argument',
    async run({ env }) {
      const route = new StepOneRoute(env)
      await route.goto()
      assert.equal(route.currentPathname, '/')
      assert.equal(await route.stepOne.heading(), 'Step one')
    },
  },
  {
    name: 'a declared param is substituted into the query string',
    async run({ env }) {
      const route = new StepTwoRoute(env)
      await route.goto({ token: 'abc123' })
      assert.equal(route.currentPathname, '/step-two')
      assert.equal(route.currentSearchParams.get('token'), 'abc123')
      assert.equal(await route.stepTwo.token(), 'abc123')
    },
  },
  {
    name: 'a repeated param is substituted at every occurrence, not just the first',
    async run({ env }) {
      const route = new RepeatedParamRoute(env)
      await route.goto({ token: 'repeated' })
      assert.equal(route.currentSearchParams.get('token'), 'repeated')
      assert.equal(
        route.currentSearchParams.get('echo'),
        'repeated',
        'the second $token was left unsubstituted — replace instead of replaceAll',
      )
    },
  },
  {
    name: 'param values are URL-encoded',
    async run({ env }) {
      const route = new RepeatedParamRoute(env)
      await route.goto({ token: 'a b&c=d' })
      assert.equal(route.currentSearchParams.get('token'), 'a b&c=d')
      assert.equal(route.currentSearchParams.get('echo'), 'a b&c=d')
    },
  },
  {
    name: 'the route composes screen harnesses that inherit its host scope',
    async run({ env }) {
      const route = new StepOneRoute(env)
      await route.goto()
      assert.equal(await route.stepOne.heading(), 'Step one')
      assert.equal(await route.stepTwo.isAbsent(), true)
      await route.stepOne.continue()
      assert.equal(await route.stepTwo.heading(), 'Step two')
    },
  },
  {
    name: 'assertPathname resolves once the URL matches',
    async run({ env }) {
      const route = new StepTwoRoute(env)
      await route.goto({ token: 'abc123' })
      await route.assertPathname('/step-two')
    },
  },
  {
    name: 'currentUrl exposes the full resolved URL',
    async run({ env }) {
      const route = new StepTwoRoute(env)
      await route.goto({ token: 'abc123' })
      assert.match(route.currentUrl, /\/step-two\?token=abc123$/)
    },
  },
  {
    name: 'an expired token routes to the expired notice',
    async run({ env }) {
      const route = new StepTwoRoute(env)
      await route.goto({ token: 'expired' })
      assert.equal(await route.stepTwo.showsExpiredNotice(), true)
      assert.equal(await route.stepTwo.token(), null)
    },
  },
  {
    name: 'a driver with no navigation capability is refused at construction',
    async run() {
      // A driver can be perfectly good at querying and have no address bar to
      // drive — jsdom is exactly that. A route must say so at the construction
      // site, not inside the first goto().
      registerDriver('conformance-no-navigation', () => ({}) as Query)
      assert.throws(
        () => new StepOneRoute({ driver: 'conformance-no-navigation' }),
        /cannot navigate/,
      )
    },
  },
  {
    name: 'goto awaits waitForReady, so an unmet readiness check rejects',
    async run({ env }) {
      const route = new NeverReadyRoute(env)
      await assert.rejects(() => route.goto(), 'goto() resolved without waiting for readiness')
    },
  },
]
