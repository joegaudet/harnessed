import '@harnessed/dom/matchers'
import { dom } from '@harnessed/dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../fixture/App'
import { CardGridHarness } from '../fixture/harnesses/CardGrid.harness'
import { LoginFormHarness } from '../fixture/harnesses/LoginForm.harness'

/** Matcher registration is per runner, so this cannot live in the shared catalog. */
function show(search: string) {
  window.history.pushState({}, '', `/${search}`)
  const { baseElement } = render(<App />)
  return dom({ user: userEvent.setup(), container: baseElement })
}

describe('matchers: dom driver', () => {
  it('toBeAbsent passes for something not rendered', async () => {
    const form = new LoginFormHarness(show('?view=login'))
    await expect(form.errorQuery).toBeAbsent()
  })

  it('toBeAbsent fails, with a count in the message, when it is rendered', async () => {
    const form = new LoginFormHarness(show('?view=login&error=Bad%20credentials'))
    await expect(expect(form.errorQuery).toBeAbsent()).rejects.toThrow(/1 node\(s\) matched/)
  })

  it('toReadAs compares a string and a pattern', async () => {
    const form = new LoginFormHarness(show('?view=login&error=Bad%20credentials'))
    await expect(form.errorQuery).toReadAs('Bad credentials')
    await expect(form.errorQuery).toReadAs(/credentials/)
  })

  it('toBeSelected reads aria-pressed off a harness host', async () => {
    const grid = new CardGridHarness(show('?view=cards'))
    await expect(grid.cardAt(1)).not.toBeSelected()
    await grid.chooseByLabel('Medium')
    await expect(grid.cardAt(1)).toBeSelected()
  })
})
