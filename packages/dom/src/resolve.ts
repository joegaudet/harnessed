import { getConfig } from '@harnessed/core'
import type { Selector } from '@harnessed/core'
import { describeScope, describeSelector } from '@harnessed/core'
import { configure as configureTestingLibrary, within } from '@testing-library/dom'
import type { ByRoleMatcher } from '@testing-library/dom'

/** `Selector` keeps `role` a plain string so it stays driver-agnostic; each driver
 *  casts it to its own role union at the boundary. */
type RoleName = ByRoleMatcher

let appliedTestIdAttribute: string | undefined

/**
 * Testing Library holds the test-id attribute in its own module-level config, so
 * ours has to be pushed across. Done at query time and only on change, because a
 * consumer may call `configure()` after the driver was imported.
 */
function syncTestIdAttribute(): void {
  const wanted = getConfig().testIdAttribute
  if (wanted !== appliedTestIdAttribute) {
    configureTestingLibrary({ testIdAttribute: wanted })
    appliedTestIdAttribute = wanted
  }
}

function timeoutFor(explicit?: number): number {
  return explicit ?? getConfig().defaultTimeout
}

/** Every match for one selector, without waiting. Zero is an answer. */
export function queryAll(root: HTMLElement, selector: Selector): HTMLElement[] {
  syncTestIdAttribute()
  const scoped = within(root)
  switch (selector.type) {
    case 'role':
      return scoped.queryAllByRole(selector.role as RoleName, selector.options)
    case 'label':
      return scoped.queryAllByLabelText(selector.text)
    case 'testId':
      return scoped.queryAllByTestId(selector.testId)
    case 'text':
      return scoped.queryAllByText(selector.text)
    case 'placeholder':
      return scoped.queryAllByPlaceholderText(selector.text)
  }
}

/**
 * One match, waiting for it to appear. Strict: several matches is an error.
 *
 * The ambiguity check runs first, without waiting. Testing Library's `findBy*` is
 * `waitFor(getBy*)`, so a "found multiple elements" error gets retried for the full
 * timeout before surfacing — but more than one match is never going to become one
 * by waiting, and Playwright's strict mode rejects at once. Checking up front keeps
 * the two drivers in step and turns a timeout into an immediate, readable failure.
 */
async function findOne(
  root: HTMLElement,
  selector: Selector,
  timeout?: number,
): Promise<HTMLElement> {
  syncTestIdAttribute()

  if (selector.nth !== undefined) {
    const all = await findAll(root, selector, timeout)
    const found = all[selector.nth]
    if (found === undefined) {
      throw new Error(
        `harnessed: index ${selector.nth} is out of range \u2014 ${all.length} node(s) matched.`,
      )
    }
    return found
  }

  const immediate = queryAll(root, selector)
  if (immediate.length > 1) {
    throw new Error(
      `harnessed: strict mode violation \u2014 ${immediate.length} nodes match ` +
        `${describeSelector(selector)}. Scope the query, or use nth()/first() only when ` +
        `the matches genuinely are the same control rendered more than once.`,
    )
  }
  if (immediate.length === 1) return immediate[0]!

  // Not on screen yet — this is the case waiting is for.
  const scoped = within(root)
  const options = { timeout: timeoutFor(timeout) }
  switch (selector.type) {
    case 'role':
      return scoped.findByRole(selector.role as RoleName, selector.options, options)
    case 'label':
      return scoped.findByLabelText(selector.text, undefined, options)
    case 'testId':
      return scoped.findByTestId(selector.testId, undefined, options)
    case 'text':
      return scoped.findByText(selector.text, undefined, options)
    case 'placeholder':
      return scoped.findByPlaceholderText(selector.text, undefined, options)
  }
}

async function findAll(
  root: HTMLElement,
  selector: Selector,
  timeout?: number,
): Promise<HTMLElement[]> {
  syncTestIdAttribute()
  const scoped = within(root)
  const options = { timeout: timeoutFor(timeout) }
  switch (selector.type) {
    case 'role':
      return scoped.findAllByRole(selector.role as RoleName, selector.options, options)
    case 'label':
      return scoped.findAllByLabelText(selector.text, undefined, options)
    case 'testId':
      return scoped.findAllByTestId(selector.testId, undefined, options)
    case 'text':
      return scoped.findAllByText(selector.text, undefined, options)
    case 'placeholder':
      return scoped.findAllByPlaceholderText(selector.text, undefined, options)
  }
}

/**
 * Walks the scope chain down to the element the final selector is queried within.
 * Waiting is correct here: a container that has not rendered yet is not the same
 * thing as a target that is absent.
 */
export async function resolveScope(
  container: HTMLElement,
  scope: readonly Selector[],
  timeout?: number,
): Promise<HTMLElement> {
  let current = container
  for (const step of scope) {
    current = await findOne(current, step, timeout)
  }
  return current
}

/** The single node a strict operation acts on. */
export async function resolveOne(
  container: HTMLElement,
  scope: readonly Selector[],
  selector: Selector,
  timeout?: number,
): Promise<HTMLElement> {
  const root = await resolveScope(container, scope, timeout)
  try {
    return await findOne(root, selector, timeout)
  } catch (cause) {
    throw new Error(`harnessed: ${describeScope(scope, selector)} — ${(cause as Error).message}`, {
      cause,
    })
  }
}

/**
 * How many nodes match. The scope chain still waits, but the final count uses the
 * non-waiting query so that zero answers immediately rather than throwing after a
 * retry timeout. This is the behaviour Playwright already had.
 */
export async function countAll(
  container: HTMLElement,
  scope: readonly Selector[],
  selector: Selector,
  timeout?: number,
): Promise<number> {
  let root: HTMLElement
  try {
    root = await resolveScope(container, scope, timeout)
  } catch {
    // The scope itself is not on screen, so nothing inside it can be either.
    return 0
  }
  const matches = queryAll(root, selector)
  if (selector.nth === undefined) return matches.length
  return matches[selector.nth] === undefined ? 0 : 1
}
