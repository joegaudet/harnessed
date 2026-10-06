// Puppeteer under Vitest. Matchers: import '@harnessed-ts/puppeteer/matchers'
// in a setup file (under Jest: expect.extend(harnessMatchers) from
// @harnessed-ts/core). Puppeteer has no baseURL of its own, so the env takes one.
import { puppeteer } from '@harnessed-ts/puppeteer'
import { launch } from 'puppeteer'
import type { Browser, Page } from 'puppeteer'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { CheckoutPage } from '../harness/checkout.page'

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await launch()
  page = await browser.newPage()
})

afterAll(async () => {
  await browser.close()
})

it('paying shows the confirmation', async () => {
  const checkout = new CheckoutPage(puppeteer(page, { baseURL: 'http://localhost:3000' }))
  await checkout.goto({ token: 'abc' })
  const confirmation = await checkout.pay()
  await expect(confirmation.heading).toReadAs('Thanks!')
})
