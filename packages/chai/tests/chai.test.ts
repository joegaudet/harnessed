import { createQuery, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import * as chai from 'chai'
import { afterEach, describe, it } from 'vitest'
import { harnessedChai } from '../src/index'

chai.use(harnessedChai)
const { expect } = chai

/**
 * The plugin adds the three harness assertions to Chai, the BDD assertion
 * library under Mocha, ember-mocha, WebdriverIO and Cypress. They are async — a
 * harness reads the page through a driver — so each returns a promise to await.
 * The failure messages come from core's shared implementation, so they read
 * the same under every runner.
 */
function target(id: string): Query {
  return createQuery(dom({ user: userEvent.setup() }), [], testId(id))
}

function show(html: string): void {
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ''
})

async function failure(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof chai.AssertionError) return error.message
    throw error
  }
  throw new Error('expected the assertion to fail')
}

describe('@harnessed-ts/chai', () => {
  it('absent: passes when nothing matches, and fails naming how many did', async () => {
    show('<p data-testid="banner">Hi</p><p data-testid="banner">Again</p>')
    await expect(target('missing')).to.be.absent
    chai.assert.match(
      await failure(() => expect(target('banner')).to.be.absent),
      /2 node\(s\) matched/,
    )
  })

  it('absent negates with .not', async () => {
    show('<p data-testid="banner">Hi</p>')
    await expect(target('banner')).not.to.be.absent
    chai.assert.match(
      await failure(() => expect(target('missing')).not.to.be.absent),
      /expected the target to be present/,
    )
  })

  it('selected reads aria-pressed', async () => {
    show(
      '<button data-testid="on" aria-pressed="true">On</button><button data-testid="off">Off</button>',
    )
    await expect(target('on')).to.be.selected
    await expect(target('off')).not.to.be.selected
    chai.assert.match(await failure(() => expect(target('off')).to.be.selected), /unset/)
  })

  it('readAs takes a string or a pattern', async () => {
    show('<span data-testid="price">$12</span>')
    await expect(target('price')).to.readAs('$12')
    await expect(target('price')).to.readAs(/^\$/)
    await expect(target('price')).not.to.readAs('$13')
    chai.assert.match(
      await failure(() => expect(target('price')).to.readAs('$13')),
      /but it was "\$12"/,
    )
  })

  it('accepts a harness as well as a target, asserting against its host', async () => {
    show('<p data-testid="banner">Hi</p>')
    const harness = { self: target('banner') }
    await expect(harness).to.readAs('Hi')
  })
})
