import '@harnessed-ts/dom/matchers'
import { dom } from '@harnessed-ts/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../fixture/App'
import type { View } from './catalog'
import { viewSearch } from './views'
import { CardsPage } from '../fixture/harnesses/pages/cards.page'
import { LoginPage } from '../fixture/harnesses/pages/login.page'

/** Matcher registration is per runner, so this cannot live in the shared catalog. */
function show(view: View) {
  window.history.pushState({}, '', `/${viewSearch(view)}`)
  const { baseElement } = render(<App />)
  return dom({ user: userEvent.setup(), container: baseElement })
}

describe('matchers: dom driver', () => {
  it('toBeAbsent passes for something not rendered', async () => {
    const login = new LoginPage(show('login'))
    await expect(login.form.errorQuery).toBeAbsent()
  })

  it('toBeAbsent fails, with a count in the message, when it is rendered', async () => {
    const login = new LoginPage(show('login-error'))
    await expect(expect(login.form.errorQuery).toBeAbsent()).rejects.toThrow(/1 node\(s\) matched/)
  })

  it('toReadAs compares a string and a pattern', async () => {
    const login = new LoginPage(show('login-error'))
    await expect(login.form.errorQuery).toReadAs('Bad credentials')
    await expect(login.form.errorQuery).toReadAs(/credentials/)
  })

  it('toBeSelected reads aria-pressed off a harness host', async () => {
    const cards = new CardsPage(show('cards'))
    await expect(cards.grid.cardAt(1)).not.toBeSelected()
    await cards.grid.chooseByLabel('Medium')
    await expect(cards.grid.cardAt(1)).toBeSelected()
  })

  it('a page is assertable against its own host', async () => {
    const login = new LoginPage(show('login'))
    await expect(login).not.toBeAbsent()
  })
})
