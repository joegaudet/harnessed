import type { PageApiOptions } from '@harnessed-ts/resolve/inject'
import { afterEach, describe, expect, it } from 'vitest'
import { pageCall } from '../src/page-functions'
import type { PageResult } from '../src/page-functions'

const NAME = '__harnessedTest'

// What the driver sends with every call. A `now` lookup answers at once, so the
// timeout is never waited on.
const OPTIONS: PageApiOptions = { testIdAttribute: 'data-testid', timeout: 0 }

/** A window holding a resolver whose `oneNow` fails as given, as the page would. */
function installResolver(oneNow: () => never): void {
  const page: Record<string, unknown> = { location: { href: 'http://test/' } }
  page.parent = page
  page[NAME] = { oneNow, visible: () => true }
  ;(globalThis as Record<string, unknown>).window = page
}

function ask(op: 'visible' | 'hidden'): PageResult {
  return pageCall(
    NAME,
    null,
    op,
    [],
    { by: 'testId', id: 'card' },
    OPTIONS,
    null,
    'now',
  ) as PageResult
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window
})

describe('pageCall visible / hidden', () => {
  it('answers an index past the last match as absent', () => {
    installResolver(() => {
      throw new Error('harnessed: index 5 is out of range — 3 node(s) match testId(card).')
    })
    expect(ask('visible').value).toBe(false)
    expect(ask('hidden').value).toBe(true)
  })

  it('lets a selector the resolver refuses through, rather than answering it as absent', () => {
    const refused = () => {
      throw new TypeError('Role "button" cannot have "level" property.')
    }
    installResolver(refused)
    expect(() => ask('visible')).toThrow(/cannot have "level"/)
    expect(() => ask('hidden')).toThrow(/cannot have "level"/)
  })
})
