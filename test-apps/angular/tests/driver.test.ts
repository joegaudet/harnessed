import { Component, inject, PendingTasks, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { createQuery, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { WizardPage } from '@harnessed-ts/conformance'
import { angular } from '@harnessed-ts/angular'
import type { AngularEnv } from '@harnessed-ts/angular'
import { render } from '@testing-library/angular/zoneless'
import { afterEach, describe, expect, it } from 'vitest'
import { renderRouted } from './show'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Work the app tracks but does not finish within an event: a click starts it,
 * and the count changes 100ms later. user-event's own pauses let a plain signal
 * update render before the next read anyway, so only tracked work like this
 * shows whether an action really ends at `whenStable()`.
 */
@Component({
  selector: 'test-slow-counter',
  template: `
    <button type="button" data-testid="go" (click)="go()">Go</button>
    <p data-testid="count">{{ count() }}</p>
  `,
})
class SlowCounter {
  protected readonly count = signal(0)
  private readonly tasks = inject(PendingTasks)

  protected go(): void {
    void this.tasks.run(async () => {
      await sleep(100)
      this.count.update(count => count + 1)
    })
  }
}

function query(env: AngularEnv, id: string): Query {
  return createQuery(env, [], testId(id))
}

/** What this driver promises beyond the shared catalog. */
describe('angular driver', () => {
  it('an action with a fixture ends once the fixture is stable', async () => {
    const { fixture } = await render(SlowCounter, { waitForStableOnRender: true })
    const env = angular({ fixture })
    await query(env, 'go').click()
    // text() reads at once; it does not wait for a value to change.
    expect(await query(env, 'count').text()).toBe('1')
  })

  describe('without a fixture', () => {
    let host: HTMLElement | undefined
    afterEach(() => host?.remove())

    it('an action ends once the ApplicationRef is stable', async () => {
      host = document.createElement('test-slow-counter')
      document.body.append(host)
      const app = await bootstrapApplication(SlowCounter)
      try {
        const env = angular({ app })
        await query(env, 'go').click()
        expect(await query(env, 'count').text()).toBe('1')
      } finally {
        app.destroy()
      }
    })
  })

  it('refuses to build an env with nothing to settle on', () => {
    expect(() => angular()).toThrow(/angular\(\) needs the app it drives/)
  })

  it('isVisible is a layout check in a browser, and a style check under jsdom', async () => {
    const { fixture } = await render(`<span data-testid="empty"></span>`, {
      waitForStableOnRender: true,
    })
    const laysOut = !navigator.userAgent.includes('jsdom')
    // A node that draws no box: invisible to a layout check, visible to a style one.
    expect(await query(angular({ fixture }), 'empty').isVisible()).toBe(!laysOut)
  })

  describe('navigation', () => {
    it('without a router, the URL members refuse with the standard message', async () => {
      const { fixture } = await render(SlowCounter, { waitForStableOnRender: true })
      const page = new WizardPage(angular({ fixture }))
      await expect(page.goto()).rejects.toThrow(/"angular" driver cannot navigate without a Router/)
      expect(() => page.currentUrl).toThrow(/cannot navigate/)
    })

    it('with a router, the URL members refuse before its first navigation', async () => {
      const page = new WizardPage(await renderRouted())
      expect(() => page.currentUrl).toThrow(/has not navigated/)
      const started = Date.now()
      await expect(page.assertPathname('/', { timeout: 2000 })).rejects.toThrow(/has not navigated/)
      expect(Date.now() - started).toBeLessThan(500)
    })

    it('goto() drives the router, and the URL is the router’s, not the address bar’s', async () => {
      const before = window.location.href
      const page = new WizardPage(await renderRouted())
      await page.goto()
      expect(page.currentPathname).toBe('/')
      // TestBed's mock platform location: the test's own URL never moved.
      expect(window.location.href).toBe(before)
    })
  })
})
