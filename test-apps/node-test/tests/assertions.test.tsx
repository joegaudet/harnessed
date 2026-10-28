import { harnessedChai } from '@harnessed-ts/chai'
import { CardsPage, LoginPage } from '@harnessed-ts/conformance'
import * as chai from 'chai'
import { expect } from 'chai'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { show } from './show.tsx'

// node:test has no `expect`, so harness assertions come through Chai.
chai.use(harnessedChai)

describe('assertions: @harnessed-ts/chai under node:test', () => {
  it('absent passes for something not rendered', async () => {
    const login = new LoginPage(await show('login'))
    await expect(login.form.errorQuery).to.be.absent
  })

  it('absent fails, with a count in the message, when it is rendered', async () => {
    const login = new LoginPage(await show('login-error'))
    await assert.rejects(async () => {
      await expect(login.form.errorQuery).to.be.absent
    }, /1 node\(s\) matched/)
  })

  it('readAs compares a string and a pattern', async () => {
    const login = new LoginPage(await show('login-error'))
    await expect(login.form.errorQuery).to.readAs('Bad credentials')
    await expect(login.form.errorQuery).to.readAs(/credentials/)
  })

  it('selected reads aria-pressed off a harness host', async () => {
    const cards = new CardsPage(await show('cards'))
    await expect(cards.grid.cardAt(1)).not.to.be.selected
    await cards.grid.chooseByLabel('Medium')
    await expect(cards.grid.cardAt(1)).to.be.selected
  })

  it('a page is assertable against its own host', async () => {
    const login = new LoginPage(await show('login'))
    await expect(login).not.to.be.absent
  })
})
