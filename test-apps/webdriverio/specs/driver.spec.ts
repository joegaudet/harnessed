import { LoginFormHarness } from '@harnessed-ts/conformance'
import { createQuery, frame, label, role, testId } from '@harnessed-ts/core'
import type { Query, Selector } from '@harnessed-ts/core'
import type { WebdriverioEnv } from '@harnessed-ts/webdriverio'
import { browser, expect } from '@wdio/globals'
import { show } from './stage'

/** Appends markup to the body, outside the fixture's React root. */
async function append(html: string): Promise<void> {
  await browser.executeScript('document.body.insertAdjacentHTML("beforeend", arguments[0])', [html])
}

function query(env: WebdriverioEnv, selector: Selector, scope: Selector[] = []): Query {
  return createQuery(env, scope, selector)
}

// What only this driver can get wrong: WebDriver's own reading of the page.
describe('webdriverio driver', () => {
  it('selectOption names the string that matches no option', async () => {
    const form = new LoginFormHarness(await show('login'))
    await expect(form.choosePlan('Platinum')).rejects.toThrow(
      /selectOption\("Platinum"\).*matches no option's value or label/,
    )
    await expect(form.chosenPlan()).resolves.toBe('free')
  })

  it('selectOption matches labels in a multi-select too', async () => {
    const form = new LoginFormHarness(await show('login'))
    await form.chooseAddons(['SMS', 'fax'])
    await expect(form.addonValues()).resolves.toEqual(['sms', 'fax'])
    await form.chooseAddons(['Voice'])
    await expect(form.addonValues()).resolves.toEqual(['voice'])
  })

  it('isVisible reads an opacity: 0 node as visible, as Playwright does', async () => {
    const env = await show('login')
    await append('<p data-testid="faded" style="opacity: 0">Faded</p>')
    await expect(query(env, testId('faded')).isVisible()).resolves.toBe(true)
  })

  it('press refuses a key name it does not know rather than typing its letters', async () => {
    const form = new LoginFormHarness(await show('login'))
    await expect(form.pressInEmail('Entr')).rejects.toThrow(/does not know the key "Entr"/)
    await expect(form.values()).resolves.toMatchObject({ email: '' })
  })

  it('press maps Playwright code names WebdriverIO lacks', async () => {
    const form = new LoginFormHarness(await show('login'))
    await form.pressInEmail('Minus')
    await form.pressInEmail('Digit1')
    await expect(form.values()).resolves.toMatchObject({ email: '-1' })
  })

  it('works inside a cross-origin frame', async () => {
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

    await expect(button.count()).resolves.toBe(1)
    await expect(button.text()).resolves.toBe('Press')
    await expect(button.isVisible()).resolves.toBe(true)
    await expect(query(env, { type: 'text', text: 'Hidden' }, inside).isVisible()).resolves.toBe(
      false,
    )
    await button.click()
    await expect(button.text()).resolves.toBe('Clicked')
    await name.fill('Ada')
    await expect(name.inputValue()).resolves.toBe('Ada')
    await expect(query(env, role('link'), inside).count()).resolves.toBe(0)
  })
})
