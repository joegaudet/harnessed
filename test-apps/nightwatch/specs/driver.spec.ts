import assert from 'node:assert/strict'
import { LoginFormHarness } from '@harnessed-ts/conformance'
import { createQuery, frame, label, role, testId } from '@harnessed-ts/core'
import type { Query, Selector } from '@harnessed-ts/core'
import type { NightwatchEnv } from '@harnessed-ts/nightwatch'
import { show } from '../support/stage.ts'

/** Appends markup to the body, outside the fixture's React root. */
async function append(html: string): Promise<void> {
  await browser.driver.executeScript(
    'document.body.insertAdjacentHTML("beforeend", arguments[0])',
    html,
  )
}

function query(env: NightwatchEnv, selector: Selector, scope: Selector[] = []): Query {
  return createQuery(env, scope, selector)
}

// What only this driver can get wrong: selenium-webdriver's reading of the page.
describe('nightwatch driver', function () {
  it('selectOption names the string that matches no option', async function () {
    const form = new LoginFormHarness(await show('login'))
    await assert.rejects(form.choosePlan('Platinum'), {
      message: /selectOption\("Platinum"\).*matches no option's value or label/,
    })
    assert.equal(await form.chosenPlan(), 'free')
  })

  it('selectOption matches labels in a multi-select too', async function () {
    const form = new LoginFormHarness(await show('login'))
    await form.chooseAddons(['SMS', 'fax'])
    assert.deepEqual(await form.addonValues(), ['sms', 'fax'])
    await form.chooseAddons(['Voice'])
    assert.deepEqual(await form.addonValues(), ['voice'])
  })

  it('isVisible reads an opacity: 0 node as visible, as Playwright does', async function () {
    const env = await show('login')
    await append('<p data-testid="faded" style="opacity: 0">Faded</p>')
    assert.equal(await query(env, testId('faded')).isVisible(), true)
  })

  it('press refuses a key name it does not know rather than typing its letters', async function () {
    const form = new LoginFormHarness(await show('login'))
    await assert.rejects(form.pressInEmail('Entr'), { message: /does not know the key "Entr"/ })
    assert.equal((await form.values()).email, '')
  })

  it('press maps Playwright code names and chords onto WebDriver keys', async function () {
    const form = new LoginFormHarness(await show('login'))
    await form.pressInEmail('Minus')
    await form.pressInEmail('Digit1')
    await form.pressInEmail('Shift+KeyA')
    assert.equal((await form.values()).email, '-1A')
  })

  it('a script error reaches the caller rather than resolving null', async function () {
    // Nightwatch's own `execute` command logs a failed script and resolves null;
    // the driver goes to selenium-webdriver's executeScript, which throws.
    await show('login')
    await assert.rejects(browser.driver.executeScript('throw new Error("boom")'), /boom/)
  })

  it('works inside a cross-origin frame', async function () {
    const env = await show('login')
    const page = [
      '<button onclick="this.textContent = \'Clicked\'">Press</button>',
      '<label>Name <input></label>',
      '<p style="display: none">Hidden</p>',
    ].join('')
    // A data: document has an opaque origin: the page's own script cannot enter it.
    await append(
      `<iframe data-testid="foreign" src="data:text/html,${encodeURIComponent(page)}"></iframe>`,
    )
    const inside = [frame(testId('foreign'))]
    const button = query(env, role('button'), inside)
    const name = query(env, label('Name'), inside)

    assert.equal(await button.count(), 1)
    assert.equal(await button.text(), 'Press')
    assert.equal(await button.isVisible(), true)
    assert.equal(await query(env, { type: 'text', text: 'Hidden' }, inside).isVisible(), false)
    await button.click()
    assert.equal(await button.text(), 'Clicked')
    await name.fill('Ada')
    assert.equal(await name.inputValue(), 'Ada')
    await name.press('Backspace')
    assert.equal(await name.inputValue(), 'Ad')
    assert.equal(await query(env, role('link'), inside).count(), 0)
  })

  it('hands the session back to the top-level document after a frame', async function () {
    const env = await show('frame')
    // Any read through a frame, then a plain script: it must run at the top.
    assert.equal(await query(env, testId('counter'), [frame(testId('framed'))]).count(), 1)
    assert.equal(
      await browser.driver.executeScript('return window === window.top'),
      true,
      'the session was left inside the frame',
    )
  })
})
