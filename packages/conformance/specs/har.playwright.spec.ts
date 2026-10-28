import { mock } from '@harnessed-ts/mock'
import { pw } from '@harnessed-ts/playwright'
import { expect, test } from '@playwright/test'
import { DataPage } from '../fixture/harnesses/pages/data.page'
import { playwrightContext } from './context'

// HAR recording needs a transport that sees real responses; Playwright's does.
// Recorded once against the real fixture server, then replayed with nothing behind it.
test('recordHar captures real traffic that fromHar then replays', async ({ page }) => {
  const env = pw(page)
  const api = mock(env, { onUnhandled: 'bypass' })
  const recording = await api.recordHar()
  // The fixture's dev server answers /api/users/1 with its SPA page: real, if not JSON.
  await page.goto('/api/users/1')
  const har = await recording.stop()
  const entry = har.log.entries.find(item => item.request.url.endsWith('/api/users/1'))
  expect(entry?.response.status).toBe(200)

  // Replay something recorded, rewritten to the shape the data screen reads.
  entry!.response.content = { size: 0, mimeType: 'application/json', text: '{"name":"Replayed"}' }
  entry!.response.headers = [{ name: 'content-type', value: 'application/json' }]
  api.reset()
  await api.fromHar({ log: { ...har.log, entries: [entry!] } })
  const data = new DataPage(await playwrightContext(page).show('data'))
  expect(await data.screen.userName()).toBe('Replayed')
})
