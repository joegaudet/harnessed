import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { NeverReadyRoute } from '../fixture/harnesses/routes/never-ready.route'
import { RepeatedParamRoute } from '../fixture/harnesses/routes/repeated-param.route'
import { StepOneRoute } from '../fixture/harnesses/routes/step-one.route'
import { StepTwoRoute } from '../fixture/harnesses/routes/step-two.route'

export interface RouteCtx {
  readonly page: Page
}

export interface RouteSpec {
  name: string
  run(ctx: RouteCtx): Promise<void>
}

/** Route behaviour is a URL, a navigation, and a readiness check. Playwright only. */
export const routeSpecs: RouteSpec[] = [
  {
    name: 'a route with no declared params navigates with no argument',
    async run({ page }) {
      const route = new StepOneRoute(page)
      await route.goto()
      assert.equal(route.currentPathname, '/')
      assert.equal(await route.stepOne.heading(), 'Step one')
    },
  },
  {
    name: 'a declared param is substituted into the query string',
    async run({ page }) {
      const route = new StepTwoRoute(page)
      await route.goto({ token: 'abc123' })
      assert.equal(route.currentPathname, '/step-two')
      assert.equal(route.currentSearchParams.get('token'), 'abc123')
      assert.equal(await route.stepTwo.token(), 'abc123')
    },
  },
  {
    name: 'a repeated param is substituted at every occurrence, not just the first',
    async run({ page }) {
      const route = new RepeatedParamRoute(page)
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
    async run({ page }) {
      const route = new RepeatedParamRoute(page)
      await route.goto({ token: 'a b&c=d' })
      assert.equal(route.currentSearchParams.get('token'), 'a b&c=d')
      assert.equal(route.currentSearchParams.get('echo'), 'a b&c=d')
    },
  },
  {
    name: 'the route composes screen harnesses that inherit its host scope',
    async run({ page }) {
      const route = new StepOneRoute(page)
      await route.goto()
      assert.equal(await route.stepOne.heading(), 'Step one')
      assert.equal(await route.stepTwo.isAbsent(), true)
      await route.stepOne.continue()
      assert.equal(await route.stepTwo.heading(), 'Step two')
    },
  },
  {
    name: 'assertPathname resolves once the URL matches',
    async run({ page }) {
      const route = new StepTwoRoute(page)
      await route.goto({ token: 'abc123' })
      await route.assertPathname('/step-two')
    },
  },
  {
    name: 'currentUrl exposes the full resolved URL',
    async run({ page }) {
      const route = new StepTwoRoute(page)
      await route.goto({ token: 'abc123' })
      assert.match(route.currentUrl, /\/step-two\?token=abc123$/)
    },
  },
  {
    name: 'an expired token routes to the expired notice',
    async run({ page }) {
      const route = new StepTwoRoute(page)
      await route.goto({ token: 'expired' })
      assert.equal(await route.stepTwo.showsExpiredNotice(), true)
      assert.equal(await route.stepTwo.token(), null)
    },
  },
  {
    name: 'goto awaits waitForReady, so an unmet readiness check rejects',
    async run({ page }) {
      const route = new NeverReadyRoute(page)
      await assert.rejects(() => route.goto(), 'goto() resolved without waiting for readiness')
    },
  },
]
