import { ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import '@harnessed-ts/should/register'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { withSteps } from '../src/steps'

@Harness({ host: testId('form') })
class FormHarness extends ComponentHarness {
  async signInAs(email: string, password: string): Promise<string> {
    return `${email}/${password}`
  }

  async greeting(): Promise<string> {
    return 'hello'
  }

  bumps = 0

  async bump(by: number): Promise<number> {
    this.bumps += by
    return this.bumps
  }
}

function recorder() {
  const labels: string[] = []
  const step = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    labels.push(label)
    await fn()
  }
  return { labels, step }
}

/** Renders the markup the harness under test drives. */
function render(html: string): void {
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ''
})

/** With `@harnessed-ts/should` registered, every harness method is a wrapper. */
describe('withSteps, with should registered', () => {
  it('still reads parameter names from the method, so secrets stay masked', async () => {
    render('<form data-testid="form"></form>')
    const { labels, step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)
    await form.signInAs('ada@example.com', 'hunter2')
    expect(labels).toEqual(['FormHarness.signInAs("ada@example.com", "•••")'])
  })

  it('keeps should on a method and on what a call returns', async () => {
    render('<form data-testid="form"></form>')
    const { step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)
    await form.greeting.should.equal('hello')
    await form.signInAs('a', 'b').should.equal('a/b')
  })

  it('asserts on the call it stepped, not a second one', async () => {
    render('<form data-testid="form"></form>')
    const { labels, step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)
    await form.bump(1).should.equal(1)
    expect(form.bumps).toBe(1)
    expect(labels).toEqual(['FormHarness.bump(1)'])
  })

  it("leaves the harness's own should alone", async () => {
    render('<form data-testid="form"></form>')
    const { step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)
    await form.should.not.be.absent()
  })
})
