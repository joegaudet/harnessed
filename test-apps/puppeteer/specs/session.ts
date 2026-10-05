import { viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { puppeteer } from '@harnessed-ts/puppeteer'
import type { PuppeteerEnv } from '@harnessed-ts/puppeteer'
import { launch } from 'puppeteer'
import type { Browser, BrowserContext, Page } from 'puppeteer'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { FIXTURE_URL } from './fixture-url'

export interface Session {
  /** The current spec's page. */
  page(): Page
  /** An env for the current spec's page, resolving relative paths against the fixture. */
  env(): PuppeteerEnv
  /** The same addressing and readiness wait the Playwright reference run uses. */
  ctx(): ConformanceCtx
}

/**
 * One browser per file, and a fresh browser context per spec, so cookies,
 * storage and the page itself cannot leak from one spec into the next.
 */
export function useBrowser(): Session {
  let browser: Browser
  let context: BrowserContext
  let current: Page

  beforeAll(async () => {
    browser = await launch({
      headless: true,
      // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox
      // needs, so it cannot start there with the sandbox on.
      args: process.env.CI ? ['--no-sandbox'] : [],
    })
  })

  afterAll(async () => {
    await browser?.close()
  })

  beforeEach(async () => {
    context = await browser.createBrowserContext()
    current = await context.newPage()
  })

  afterEach(async () => {
    await context?.close()
  })

  const env = (): PuppeteerEnv => puppeteer(current, { baseURL: FIXTURE_URL })

  return {
    page: () => current,
    env,
    ctx: () => ({
      async show(view: View) {
        await current.goto(`${FIXTURE_URL}/${viewSearch(view)}`, {
          waitUntil: 'domcontentloaded',
        })
        await current.waitForSelector('[data-testid="stage"]')
        return env()
      },
    }),
  }
}
