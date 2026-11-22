import { ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'

/** The attempts counter inside the form. */
export class CounterHarness extends ComponentHarness {
  async value(): Promise<number> {
    return Number(await this.self.text())
  }
}
// Applied by hand: these tests run without a decorator transform.
Harness({ host: testId('attempts') })(CounterHarness, {} as ClassDecoratorContext)

/** A form with an error line, a toggle button and a few readings to assert on. */
export class FormHarness extends ComponentHarness {
  calls = 0

  get errorLine(): Query {
    return this.elementBy(testId('error'))
  }

  get submitButton(): Query {
    return this.elementBy(testId('submit'))
  }

  async error(): Promise<string | null> {
    this.calls++
    return (await this.errorLine.count()) === 0 ? null : this.errorLine.text()
  }

  async hasError(): Promise<boolean> {
    return (await this.error()) !== null
  }

  async attempts(): Promise<number> {
    return Number(await this.elementBy(testId('attempts')).text())
  }

  async tags(): Promise<string[]> {
    return (await this.elementBy(testId('tags')).text()).split(',')
  }

  async profile(): Promise<{ name: string; roles: string[] }> {
    return { name: await this.elementBy(testId('name')).text(), roles: await this.tags() }
  }

  async cell(row: number, column: string): Promise<string> {
    return `${row}:${column}`
  }

  async missing(): Promise<undefined> {
    return undefined
  }

  async explode(): Promise<string> {
    this.calls++
    throw new Error('the form blew up')
  }

  /** Named like a chain word, which no longer matters: `should` follows the member. */
  async has(tag: string): Promise<boolean> {
    return (await this.tags()).includes(tag)
  }

  /** A child harness, to show it gets `should` too. */
  get counter(): CounterHarness {
    return this.childHarness(CounterHarness)
  }

  label(): string {
    return 'form'
  }

  async submitIt(): Promise<void> {
    await this.submitButton.click()
  }
}
// Applied by hand: these tests run without a decorator transform.
Harness({ host: testId('form') })(FormHarness, {} as ClassDecoratorContext)

export function show(html: string): FormHarness {
  document.body.innerHTML = `<form data-testid="form">${html}</form>`
  return new FormHarness(dom({ user: userEvent.setup() }))
}

/** Re-renders the form without its error line, keeping the same host. */
export function clearError(): void {
  document.body.innerHTML = '<form data-testid="form"></form>'
}

export const FULL_FORM = `
  <p data-testid="error">Bad credentials</p>
  <button type="button" data-testid="submit" aria-pressed="true">Go</button>
  <span data-testid="attempts">3</span>
  <span data-testid="tags">admin,editor</span>
  <span data-testid="name">Ada</span>
`

/** The message of the assertion error `run` rejects with. */
export async function failure(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error && error.name === 'AssertionError') return error.message
    throw error
  }
  throw new Error('expected the assertion to fail')
}
