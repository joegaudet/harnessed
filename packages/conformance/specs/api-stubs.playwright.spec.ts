import { createApiStubs } from '@harnessed-ts/playwright'
import { expect, test } from '@playwright/test'
import { DataPage } from '../fixture/harnesses/pages/data.page'
import { playwrightContext } from './context'

// The deprecated createApiStubs, now a shim over mock(): same table, same state,
// same fallback, same "anything outside the pattern goes to the network".
test('createApiStubs answers from its table, with mutable state', async ({ page }) => {
  const stubs = createApiStubs({
    defaults: { name: 'Ada' },
    routes: { '/users/1': state => ({ name: state.name }) },
  })
  stubs.stubs.name = 'Grace'
  await stubs.install(page)
  const data = new DataPage(await playwrightContext(page).show('data')).screen
  expect(await data.userName()).toBe('Grace')
})

test('createApiStubs answers an unlisted path with its fallback', async ({ page }) => {
  const stubs = createApiStubs({ defaults: {}, routes: {}, fallback: () => ({ name: 'fallback' }) })
  await stubs.install(page)
  const data = new DataPage(await playwrightContext(page).show('data')).screen
  expect(await data.userName()).toBe('fallback')
})
