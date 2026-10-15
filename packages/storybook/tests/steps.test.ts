import { ByTestId, ComponentHarness, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { stepLabel, withSteps } from '../src/steps'

@Harness({ host: testId('row') })
class RowHarness extends ComponentHarness {
  @ByTestId('label') private accessor labelLine!: Query

  async label(): Promise<string> {
    return this.labelLine.text()
  }
}

@Harness({ host: testId('form') })
class FormHarness extends ComponentHarness {
  @ByTestId('name') private accessor name!: Query

  async fillName(name: string): Promise<void> {
    await this.name.fill(name)
  }

  async signInAs(email: string, password: string): Promise<string> {
    return `${email}/${password}`
  }

  async fillIn(fields: { email: string; password: string }): Promise<void> {
    void fields
  }

  async nameValue(): Promise<string> {
    return this.name.inputValue()
  }

  /** Calls another public method: only the outer call is a step. */
  async rename(name: string): Promise<string> {
    await this.fillName(name)
    return this.nameValue()
  }

  rowAt(index: number): RowHarness {
    return this.childHarness(RowHarness).nth(index)
  }
}

@Harness({ host: testId('form') })
class AccessorHarness extends ComponentHarness {
  // An accessor is backed by a private slot: read through the wrong `this`, it throws.
  @ByTestId('name') accessor field!: Query

  _field(): Query {
    return this.field
  }
}

type Recorded = { label: string; depth: number }

function recorder() {
  const steps: Recorded[] = []
  let depth = 0
  const step = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    steps.push({ label, depth })
    depth += 1
    try {
      await fn()
    } finally {
      depth -= 1
    }
  }
  return { steps, step }
}

/** Renders the markup the harnesses under test drive. */
function render(html: string): void {
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('withSteps', () => {
  it('runs each async public method inside a step named Harness.method(args)', async () => {
    render('<form data-testid="form"><input data-testid="name" /></form>')
    const { steps, step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)

    await form.fillName('Ada')

    expect(steps).toEqual([{ label: 'FormHarness.fillName("Ada")', depth: 0 }])
    expect(await new FormHarness(dom({ user: userEvent.setup() })).nameValue()).toBe('Ada')
  })

  it('passes the return value through', async () => {
    const { step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)
    expect(await form.signInAs('a@b.c', 'pw')).toBe('a@b.c/pw')
  })

  it('logs only the outer call when a method calls another public method', async () => {
    render('<form data-testid="form"><input data-testid="name" /></form>')
    const { steps, step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)

    expect(await form.rename('Grace')).toBe('Grace')
    expect(steps.map(s => s.label)).toEqual(['FormHarness.rename("Grace")'])
  })

  it('leaves sync methods sync and wraps the harness they return', async () => {
    render(
      '<form data-testid="form"><div data-testid="row"><span data-testid="label">one</span></div>' +
        '<div data-testid="row"><span data-testid="label">two</span></div></form>',
    )
    const { steps, step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)

    const row = form.rowAt(1)
    expect(row).not.toBeInstanceOf(Promise)
    expect(row).toBeInstanceOf(RowHarness)
    expect(await row.label()).toBe('two')
    expect(steps.map(s => s.label)).toEqual(['RowHarness.label()'])
  })

  it('reads decorated private accessors through the proxy', async () => {
    render('<form data-testid="form"><input data-testid="name" value="x" /></form>')
    const { step } = recorder()
    const form = withSteps(new FormHarness(dom({ user: userEvent.setup() })), step)
    expect(await form.nameValue()).toBe('x')
  })

  it('still runs a method it does not log against the real instance', () => {
    const { step } = recorder()
    const raw = new AccessorHarness(dom({ user: userEvent.setup() }))
    const harness = withSteps(raw, step)
    expect(harness._field()).toStrictEqual(raw.field)
  })

  it('assigns a decorated accessor on the real instance, not the proxy', () => {
    const { step } = recorder()
    const raw = new AccessorHarness(dom({ user: userEvent.setup() }))
    const harness = withSteps(raw, step)
    expect(() => {
      harness.field = raw.field
    }).not.toThrow()
  })
})

describe('stepLabel', () => {
  it('redacts a positional argument whose parameter name looks secret', () => {
    expect(
      stepLabel('FormHarness', FormHarness.prototype.signInAs, ['ada@example.com', 'hunter2']),
    ).toBe('FormHarness.signInAs("ada@example.com", "•••")')
  })

  it('redacts secret-looking keys inside an object argument', () => {
    expect(
      stepLabel('FormHarness', FormHarness.prototype.fillIn, [{ email: 'a@b.c', password: 'x' }]),
    ).toBe('FormHarness.fillIn({"email":"a@b.c","password":"•••"})')
  })

  it.each([
    'apiKey',
    'api_key',
    'APIKey',
    'pin',
    'pinCode',
    'otp',
    'credential',
    'auth',
    'authHeader',
    'passcode',
  ])('redacts an object key named %s', key => {
    expect(stepLabel('FormHarness', FormHarness.prototype.fillIn, [{ [key]: 'x' }])).toBe(
      `FormHarness.fillIn({"${key}":"•••"})`,
    )
  })

  it.each(['author', 'keyboard', 'monkey', 'typing', 'spinner', 'shopping', 'email', 'name'])(
    'shows an object key named %s',
    key => {
      expect(stepLabel('FormHarness', FormHarness.prototype.fillIn, [{ [key]: 'x' }])).toBe(
        `FormHarness.fillIn({"${key}":"x"})`,
      )
    },
  )

  it('redacts a positional argument named like an API key', () => {
    const method = async (id: string, apiKey: string) => `${id}${apiKey}`
    expect(stepLabel('ApiHarness', method, ['42', 'sk-live'], 'connect')).toBe(
      'ApiHarness.connect("42", "•••")',
    )
  })

  it('truncates long arguments', () => {
    const label = stepLabel('FormHarness', FormHarness.prototype.fillName, ['x'.repeat(200)])
    expect(label.length).toBeLessThan(80)
    expect(label).toMatch(/…"\)$/)
  })
})
