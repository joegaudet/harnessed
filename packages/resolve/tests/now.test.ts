// @vitest-environment jsdom
import type { Selector } from '@harnessed-ts/core'
import { afterEach, describe, expect, it } from 'vitest'
import { countAll, resolveAll, resolveAllNow, resolveOne, resolveOneNow } from '../src/resolve'

/**
 * The non-waiting forms exist for runtimes that do their own retrying. They are
 * only safe if they reject exactly what the waiting forms reject at once —
 * otherwise a remote driver polls a mistake until it times out and then reports
 * "not found". Each case runs both forms against the same markup.
 */
const TIMEOUT = 150

function mount(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body
}

afterEach(() => {
  document.body.innerHTML = ''
})

const button = (extra: Partial<Selector> = {}): Selector =>
  ({ type: 'role', role: 'button', ...extra }) as Selector
const section: Selector = { type: 'testId', testId: 's' }

describe('single target: oneNow agrees with one', () => {
  it('absent: one waits then rejects; oneNow is null', async () => {
    const root = mount('<p>nothing</p>')
    expect(resolveOneNow(root, [], button())).toBeNull()
    await expect(resolveOne(root, [], button(), TIMEOUT)).rejects.toThrow()
  })

  it('ambiguous: both reject at once, naming the selector', async () => {
    const root = mount('<button>A</button><button>B</button>')
    expect(() => resolveOneNow(root, [], button())).toThrow(/strict mode violation/)
    await expect(resolveOne(root, [], button(), TIMEOUT)).rejects.toThrow(/strict mode violation/)
  })

  it('nth past the end of a non-empty set: both reject at once', async () => {
    const root = mount('<button>A</button>')
    expect(() => resolveOneNow(root, [], button({ nth: 3 }))).toThrow(/out of range/)
    await expect(resolveOne(root, [], button({ nth: 3 }), TIMEOUT)).rejects.toThrow(/out of range/)
  })

  it('nth past the end inside a scope step: both reject at once', async () => {
    const root = mount('<section data-testid="s"><button>A</button></section>')
    const scope = [{ ...section, nth: 2 }]
    expect(() => resolveOneNow(root, scope, button())).toThrow(/out of range/)
    await expect(resolveOne(root, scope, button(), TIMEOUT)).rejects.toThrow(/out of range/)
  })

  it('a frame marker on a non-iframe: both reject at once', async () => {
    const root = mount('<section data-testid="s"><button>A</button></section>')
    const scope = [{ ...section, frame: true as const }]
    expect(() => resolveOneNow(root, scope, button())).toThrow(/<iframe>/)
    await expect(resolveOne(root, scope, button(), TIMEOUT)).rejects.toThrow(/<iframe>/)
  })
})

describe('lists: allNow agrees with count', () => {
  it('an absent scope is empty, not an error', async () => {
    const root = mount('<button>A</button>')
    const scope = [section]
    expect(resolveAllNow(root, scope, button())).toEqual([])
    expect(await countAll(root, scope, button(), TIMEOUT)).toBe(0)
  })

  it('an ambiguous scope is empty for both', async () => {
    const root = mount(
      '<section data-testid="s"><button>A</button></section><section data-testid="s"><button>B</button></section>',
    )
    const scope = [section]
    expect(resolveAllNow(root, scope, button())).toEqual([])
    expect(await countAll(root, scope, button(), TIMEOUT)).toBe(0)
  })

  it('nth past the end is empty for both', async () => {
    const root = mount('<button>A</button>')
    expect(resolveAllNow(root, [], button({ nth: 4 }))).toEqual([])
    expect(await countAll(root, [], button({ nth: 4 }), TIMEOUT)).toBe(0)
  })

  it('resolveAll ignores nth: a list is every match', async () => {
    const root = mount('<button>A</button><button>B</button>')
    const all = await resolveAll(root, [], button({ nth: 1 }), TIMEOUT)
    expect(all.map(node => node.textContent)).toEqual(['A', 'B'])
  })
})
