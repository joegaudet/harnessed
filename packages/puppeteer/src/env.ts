import type { EnvConfig } from '@harnessed-ts/core'
import type { Page } from 'puppeteer'
import { PUPPETEER_DRIVER } from './driver-id'
// Side effect: constructing an env is the moment the driver has to be registered,
// and a bare re-export could be tree-shaken away.
import './puppeteer-query'

export { PUPPETEER_DRIVER }

export interface PuppeteerEnv extends EnvConfig {
  readonly driver: typeof PUPPETEER_DRIVER
  readonly page: Page
  /**
   * What a page's relative `path` resolves against in `goto()`. Puppeteer has no
   * `baseURL` of its own, unlike Playwright's config. Without one, a relative
   * path resolves against the page's current URL.
   */
  readonly baseURL: string | undefined
}

export interface PuppeteerEnvOptions {
  baseURL?: string
}

/** Builds the env a harness is constructed with under Puppeteer. */
export function puppeteer(page: Page, options: PuppeteerEnvOptions = {}): PuppeteerEnv {
  return { driver: PUPPETEER_DRIVER, page, baseURL: options.baseURL }
}
