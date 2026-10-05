import { join } from 'node:path'
import { viewSearch } from '@harnessed-ts/conformance'
import { pw } from '@harnessed-ts/playwright'
import type { Page } from '@playwright/test'
import { test } from '@playwright/test'
import { demo } from '../src/demo'
import { rawDir, RECORDING, writeJson } from '../src/raw'
import { sleep, STEP_PAUSE_MS, stepper, TAIL_MS, VIEWPORT } from '../src/timeline'
import type { EnvId, Timeline } from '../src/timeline'

async function showView(page: Page, view: Parameters<typeof viewSearch>[0]) {
  await page.goto(`/${viewSearch(view)}`)
  await page.waitForSelector('[data-testid="stage"]')
  return pw(page)
}

test('runs the demo under Playwright', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(90_000)
  const env = `playwright-${testInfo.project.name}` as EnvId

  if (RECORDING) {
    // Load the app once off camera, so the footage does not open on a cold start.
    const warm = await browser.newPage({ baseURL, viewport: VIEWPORT })
    await showView(warm, 'login')
    await warm.close()
  }

  const context = await browser.newContext({
    baseURL,
    viewport: VIEWPORT,
    ...(RECORDING ? { recordVideo: { dir: rawDir(env), size: VIEWPORT } } : {}),
  })
  const page = await context.newPage()
  const started = Date.now()
  const { steps, step } = stepper({
    now: () => Date.now() - started,
    pauseMs: RECORDING ? STEP_PAUSE_MS : 0,
  })
  let firstPaint: number | undefined

  await demo({
    async show(view) {
      const shown = await showView(page, view)
      if (RECORDING && firstPaint === undefined) {
        // The video's first frame comes a little after the page opens, by an amount
        // that varies. The first paint is one moment both clocks can see: the
        // browser timestamps it, and it is the footage's first non-blank frame.
        await page.waitForFunction(() => performance.getEntriesByType('paint').length > 0)
        const paint = await page.evaluate(() => {
          const fcp = performance.getEntriesByName('first-contentful-paint')[0]
          return performance.timeOrigin + fcp!.startTime
        })
        firstPaint = Math.round(paint - started)
      }
      return shown
    },
    step,
  })

  if (RECORDING) {
    const end = Date.now() - started
    await sleep(TAIL_MS)
    const video = page.video()!
    await context.close()
    await video.saveAs(join(rawDir(env), 'footage.webm'))
    await video.delete()
    const timeline: Timeline = { env, steps, end, firstPaint }
    writeJson(env, 'timeline.json', timeline)
  } else {
    await context.close()
  }
})
