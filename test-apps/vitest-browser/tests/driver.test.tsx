import { createQuery, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import type { ReactNode } from 'react'
import { cleanup, render } from 'vitest-browser-react/pure'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)

async function query(id: string, tree: ReactNode): Promise<Query> {
  const { baseElement } = await render(<>{tree}</>)
  return createQuery(vitestBrowser({ container: baseElement }), [], testId(id))
}

/** Rejects, and within a bound well short of the test's own timeout. */
async function rejectsWithin(action: Promise<unknown>, ms: number): Promise<void> {
  const started = Date.now()
  await expect(action).rejects.toThrow()
  expect(Date.now() - started).toBeLessThan(ms)
}

/**
 * What this driver promises beyond the shared catalog. The provider's own
 * actionTimeout defaults to none at all, so an action that can never happen
 * would hang until the test timed out — unless the driver hands its timeout on.
 */
describe('vitest-browser driver', () => {
  it('gives up clicking a disabled button within the timeout', async () => {
    const button = await query(
      'go',
      <button data-testid="go" disabled>
        Go
      </button>,
    )
    await rejectsWithin(button.click({ timeout: 300 }), 1500)
  })

  it('gives up filling a disabled input within the timeout', async () => {
    const input = await query('name', <input data-testid="name" aria-label="Name" disabled />)
    await rejectsWithin(input.fill('x', { timeout: 300 }), 1500)
  })

  it('gives up clearing a readonly input within the timeout', async () => {
    const input = await query(
      'name',
      <input data-testid="name" aria-label="Name" readOnly defaultValue="kept" />,
    )
    await rejectsWithin(input.clear({ timeout: 300 }), 1500)
    expect(await input.inputValue()).toBe('kept')
  })

  it('gives up selecting in a disabled select within the timeout', async () => {
    const select = await query(
      'plan',
      <select data-testid="plan" aria-label="Plan" disabled>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>,
    )
    await rejectsWithin(select.selectOption('pro', { timeout: 300 }), 1500)
  })

  it('gives up hovering a hidden element within the timeout', async () => {
    const tip = await query(
      'tip',
      <span data-testid="tip" style={{ visibility: 'hidden' }}>
        ?
      </span>,
    )
    await rejectsWithin(tip.hover({ timeout: 300 }), 1500)
  })
})
