import { createQuery, frame, navigationFor, role, testId } from '@harnessed-ts/core'
import { puppeteer } from '@harnessed-ts/puppeteer'
import { describe, expect, it } from 'vitest'
import { useBrowser } from './session'

const session = useBrowser()

/**
 * What this driver promises beyond the shared catalog: the things Puppeteer can
 * do that an in-page resolver cannot, and the edges of its own adapters.
 */
describe('puppeteer driver', () => {
  it('enters a cross-origin frame, which no in-page resolver can reach', async () => {
    const page = session.page()
    // A data: document has an opaque origin, so script in the page cannot see in.
    await page.setContent(
      `<iframe data-testid="pay" src="data:text/html,<button>Pay now</button>"></iframe>`,
    )
    const unreachable = await page.evaluate(
      () => document.querySelector('iframe')?.contentDocument === null,
    )
    expect(unreachable).toBe(true)

    const pay = createQuery(puppeteer(page), [frame(testId('pay'))], role('button'))
    expect(await pay.text()).toBe('Pay now')
    expect(await pay.count()).toBe(1)
    expect(await pay.isVisible()).toBe(true)
  })

  it('names the whole scope chain for a strict violation inside a frame', async () => {
    const page = session.page()
    await page.setContent(
      `<div data-testid="shell"><iframe data-testid="pay" srcdoc="<button>Pay</button><button>Pay</button>"></iframe></div>`,
    )
    const pay = createQuery(
      puppeteer(page),
      [testId('shell'), frame(testId('pay'))],
      role('button', { name: 'Pay' }),
    )
    await expect(pay.text()).rejects.toThrow(
      'strict mode violation — 2 nodes match testId(shell) > frame(testId(pay)) > role("button", name=Pay).',
    )
  })

  it('re-injects the resolver into each new document', async () => {
    const page = session.page()
    const heading = createQuery(session.env(), [], role('heading', { level: 1 }))
    await session.ctx().show('login')
    expect(await heading.text()).toBe('Sign in')
    await session.ctx().show('wizard')
    expect(await heading.text()).toBe('Step one')
    expect(await page.evaluate(() => '__harnessedResolve' in window)).toBe(true)
  })

  it('presses a chord with its modifiers held', async () => {
    const page = session.page()
    await page.setContent(
      `<input aria-label="Keys" onkeydown="this.dataset.last = event.shiftKey + ':' + event.key">`,
    )
    const keys = createQuery(puppeteer(page), [], role('textbox', { name: 'Keys' }))
    await keys.press('Shift+ArrowLeft')
    expect(await keys.attribute('data-last')).toBe('true:ArrowLeft')
  })

  it('selects an option by its label as well as its value', async () => {
    const page = session.page()
    await page.setContent(
      `<select aria-label="Plan"><option value="free">Free</option><option value="pro">Pro plan</option></select>`,
    )
    const plan = createQuery(puppeteer(page), [], role('combobox', { name: 'Plan' }))
    await plan.selectOption('Pro plan')
    expect(await plan.selectedOptions()).toEqual(['pro'])
  })

  it('refuses to fill an element that takes no text', async () => {
    const page = session.page()
    await page.setContent(`<p data-testid="para">text</p>`)
    const para = createQuery(puppeteer(page), [], testId('para'))
    await expect(para.fill('x')).rejects.toThrow(/fill\(\) needs an <input>/)
  })

  it('asks for a baseURL when a relative path has nothing to resolve against', async () => {
    const env = puppeteer(session.page())
    await expect(navigationFor(env).goto(env, '/step-two')).rejects.toThrow(/Pass a baseURL/)
  })
})
