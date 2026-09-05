import type { EnvConfig } from '@harnessed/core'
import { pw } from '@harnessed/playwright'
import type { Page } from '@playwright/test'
import type { ConformanceCtx, View } from './catalog'
import { viewSearch } from './views'

/**
 * Shared so the matcher specs reach a view exactly the way the parity run does —
 * they previously hardcoded the query strings and skipped the readiness wait,
 * which is a flake waiting to happen.
 */
export function playwrightContext(page: Page): ConformanceCtx {
  return {
    async show(view: View): Promise<EnvConfig> {
      await page.goto(`/${viewSearch(view)}`)
      await page.waitForSelector('[data-testid="stage"]')
      return pw(page)
    },
  }
}
