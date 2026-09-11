import assert from 'node:assert/strict'
import { registerDriver } from '@harnessed-ts/core'
import type { EnvConfig, Query } from '@harnessed-ts/core'
import { CardsPage } from '../fixture/harnesses/pages/cards.page'
import { DialogPage } from '../fixture/harnesses/pages/dialog.page'
import { LoginPage } from '../fixture/harnesses/pages/login.page'
import { NeverReadyPage } from '../fixture/harnesses/pages/never-ready.page'
import { RepeatedParamPage } from '../fixture/harnesses/pages/repeated-param.page'
import { StepOnePage, StepTwoPage } from '../fixture/harnesses/pages/wizard-step.page'
import { WizardPage } from '../fixture/harnesses/pages/wizard.page'
import type { ConformanceCtx } from './catalog'

export interface PageSpec {
  name: string
  run(ctx: ConformanceCtx): Promise<void>
}

/**
 * A probe's timeout, and how long it may overrun. The slack sits below the 750ms
 * NeverReadyPage bounds its own wait at, so a probe that ignored its timeout and
 * simply waited the inner check out would fail here.
 */
const PROBE_MS = 300
const PROBE_SLACK_MS = 600

/**
 * Page behaviour that every driver shares: a page constructs anywhere, composes
 * harnesses and pages under its own scope, knows when it has arrived, and hands
 * back the page an interaction leads to. Written once and run by every driver.
 */
export const pageSpecs: PageSpec[] = [
  // ---------------------------------------------------------------- guarantee 6
  {
    name: 'guarantee 6: a page composes a component harness under its own scope',
    async run(ctx) {
      const page = new LoginPage(await ctx.show('login'))
      assert.equal(await page.form.heading(), 'Sign in')
    },
  },
  {
    name: 'guarantee 6: page scope does not leak past the child it composes',
    async run(ctx) {
      const page = new CardsPage(await ctx.show('cards'))
      // The decoy hint is inside the page but outside the grid.
      assert.equal(await page.grid.hintCount(), 2)
    },
  },
  {
    name: 'guarantee 6: a global field still escapes from a component nested in a page',
    async run(ctx) {
      const page = new DialogPage(await ctx.show('dialog'))
      await page.dialog.open()
      assert.equal(await page.dialog.bodyText(), 'Are you sure?')
      assert.equal(await page.dialog.scopedBodyCount(), 0)
    },
  },
  {
    name: 'guarantee 6: a page nests pages, which inherit its scope',
    async run(ctx) {
      const wizard = new WizardPage(await ctx.show('wizard'))
      assert.equal(await wizard.stepOne.heading(), 'Step one')
      assert.equal(await wizard.stepTwo.isAbsent(), true)
      await wizard.stepOne.continue()
      assert.equal(await wizard.stepTwo.heading(), 'Step two')
      assert.equal(await wizard.stepOne.isAbsent(), true)
    },
  },

  // ---------------------------------------------------------------- guarantee 7
  {
    name: 'guarantee 7: expectReady resolves for a page that is on screen',
    async run(ctx) {
      const page = new LoginPage(await ctx.show('login'))
      await page.expectReady()
      assert.equal(await page.isReady(), true)
    },
  },
  {
    name: 'guarantee 7: isReady answers false, without throwing, within its timeout',
    async run(ctx) {
      const page = new NeverReadyPage(await ctx.show('login'))
      const started = Date.now()
      assert.equal(await page.isReady({ timeout: PROBE_MS }), false)
      const elapsed = Date.now() - started
      assert.ok(elapsed < PROBE_SLACK_MS, `isReady overran its timeout: ${elapsed}ms`)
    },
  },
  {
    name: 'guarantee 7: expectReady rejects naming the page when it never arrives',
    async run(ctx) {
      const page = new NeverReadyPage(await ctx.show('login'))
      await assert.rejects(
        () => page.expectReady({ timeout: PROBE_MS }),
        /^Error: harnessed: NeverReadyPage did not become ready within 300ms\.$/,
      )
    },
  },

  // ---------------------------------------------------------------- guarantee 8
  {
    name: 'guarantee 8: an action hands back the page it leads to, ready and in scope',
    async run(ctx) {
      const wizard = new WizardPage(await ctx.show('wizard'))
      const stepTwo = await wizard.stepOne.continue()
      assert.ok(stepTwo instanceof StepTwoPage)
      assert.equal(await stepTwo.heading(), 'Step two')
      assert.equal(await stepTwo.token(), 'in-page')
      // Still under page-wizard: one match, not a page-wide search.
      assert.equal(await stepTwo.count(), 1)
    },
  },

  // ---------------------------------------------------------------- guarantee 9
  {
    name: 'guarantee 9: a page constructs under a driver that cannot navigate',
    async run() {
      // A driver can be perfectly good at querying and have no address bar to
      // drive — jsdom is exactly that. A page must still construct; only the
      // URL members refuse, and they say why.
      registerDriver('conformance-no-navigation', () => ({}) as Query)
      const env: EnvConfig = { driver: 'conformance-no-navigation' }
      const page = new LoginPage(env)
      await assert.rejects(() => page.goto(), /cannot navigate/)
      assert.throws(() => page.currentUrl, /cannot navigate/)
      assert.throws(() => page.currentPathname, /cannot navigate/)
      assert.throws(() => page.currentSearchParams, /cannot navigate/)
      await assert.rejects(() => page.assertPathname('/'), /cannot navigate/)
    },
  },
  {
    name: 'guarantee 9: goto on a page with no path is refused before navigating',
    async run(ctx) {
      const stepOne = new StepOnePage(await ctx.show('wizard'))
      await assert.rejects(() => stepOne.goto(), /StepOnePage declares no path/)
    },
  },
]

export interface UrlCtx {
  /**
   * An env for a driver that can navigate. The suite never builds one itself —
   * that would mean importing a concrete driver, and this package must stay
   * installable by an author whose driver is neither of the built-in two.
   */
  readonly env: EnvConfig
}

export interface UrlSpec {
  name: string
  run(ctx: UrlCtx): Promise<void>
}

/** URL behaviour: a path, a navigation, and the URL after it. Navigating drivers only. */
export const urlSpecs: UrlSpec[] = [
  {
    name: 'a page with no declared params navigates with no argument',
    async run({ env }) {
      const wizard = new WizardPage(env)
      await wizard.goto()
      assert.equal(wizard.currentPathname, '/')
      assert.equal(await wizard.stepOne.heading(), 'Step one')
    },
  },
  {
    name: 'a declared param is substituted into the query string',
    async run({ env }) {
      const stepTwo = new StepTwoPage(env)
      await stepTwo.goto({ token: 'abc123' })
      assert.equal(stepTwo.currentPathname, '/step-two')
      assert.equal(stepTwo.currentSearchParams.get('token'), 'abc123')
      assert.equal(await stepTwo.token(), 'abc123')
    },
  },
  {
    name: 'a repeated param is substituted at every occurrence, not just the first',
    async run({ env }) {
      const page = new RepeatedParamPage(env)
      await page.goto({ token: 'repeated' })
      assert.equal(page.currentSearchParams.get('token'), 'repeated')
      assert.equal(
        page.currentSearchParams.get('echo'),
        'repeated',
        'the second $token was left unsubstituted — replace instead of replaceAll',
      )
    },
  },
  {
    name: 'param values are URL-encoded',
    async run({ env }) {
      const page = new RepeatedParamPage(env)
      await page.goto({ token: 'a b&c=d' })
      assert.equal(page.currentSearchParams.get('token'), 'a b&c=d')
      assert.equal(page.currentSearchParams.get('echo'), 'a b&c=d')
    },
  },
  {
    name: 'a page reached by goto composes and transitions like any other',
    async run({ env }) {
      const wizard = new WizardPage(env)
      await wizard.goto()
      assert.equal(await wizard.stepTwo.isAbsent(), true)
      const stepTwo = await wizard.stepOne.continue()
      assert.equal(await stepTwo.heading(), 'Step two')
      assert.equal(await wizard.stepTwo.heading(), 'Step two')
    },
  },
  {
    name: 'assertPathname resolves once the URL matches',
    async run({ env }) {
      const stepTwo = new StepTwoPage(env)
      await stepTwo.goto({ token: 'abc123' })
      await stepTwo.assertPathname('/step-two')
    },
  },
  {
    name: 'currentUrl exposes the full resolved URL',
    async run({ env }) {
      const stepTwo = new StepTwoPage(env)
      await stepTwo.goto({ token: 'abc123' })
      assert.match(stepTwo.currentUrl, /\/step-two\?token=abc123$/)
    },
  },
  {
    name: 'an expired token routes to the expired notice',
    async run({ env }) {
      const stepTwo = new StepTwoPage(env)
      await stepTwo.goto({ token: 'expired' })
      assert.equal(await stepTwo.showsExpiredNotice(), true)
      assert.equal(await stepTwo.token(), null)
    },
  },
  {
    name: 'goto awaits readiness, so an unmet readiness check rejects with its cause',
    async run({ env }) {
      const page = new NeverReadyPage(env)
      await assert.rejects(
        () => page.goto(),
        (error: unknown) =>
          error instanceof Error &&
          /NeverReadyPage did not become ready\./.test(error.message) &&
          error.cause instanceof Error,
      )
    },
  },
]
