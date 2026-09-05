import { indexOutOfRange, strictViolation, testIdSync, timeoutFor } from '@harnessed-ts/core'
import type { Selector } from '@harnessed-ts/core'
import { configure as configureTestingLibrary, within } from '@testing-library/dom'
import type { ByRoleMatcher } from '@testing-library/dom'

/** `Selector` keeps `role` a plain string so it stays driver-agnostic; each driver
 *  casts it to its own role union at the boundary. */
type RoleName = ByRoleMatcher

const syncTestIdAttribute = testIdSync(testIdAttribute =>
  configureTestingLibrary({ testIdAttribute }),
)

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
 * The non-waiting query runs first. Testing Library's `findBy*` is
 * `waitFor(getBy*)`, so a "found multiple elements" error is retried for the full
 * timeout before surfacing — but more than one match never becomes one by
 * waiting, and Playwright rejects at once. Checking up front keeps the two
 * drivers in step and turns a timeout into an immediate, readable failure.
 *
 * The check is applied to the waited result too. Otherwise the guarantee would
 * hold only for nodes that happened to be on screen already, and a target that
 * renders late as two nodes would still sit out the whole timeout.
 */
async function findOne(
  root: HTMLElement,
  scope: readonly Selector[],
  selector: Selector,
  timeout?: number,
): Promise<HTMLElement> {
  syncTestIdAttribute()

  const immediate = queryAll(root, selector)
  const resolved = immediate.length > 0 ? immediate : await findAll(root, selector, timeout)

  if (selector.nth !== undefined) {
    const found = resolved[selector.nth]
    if (found === undefined) {
      throw indexOutOfRange(selector.nth, resolved.length, scope, selector)
    }
    return found
  }

  if (resolved.length > 1) throw strictViolation(resolved.length, scope, selector)
  return resolved[0]!
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
  for (const [index, step] of scope.entries()) {
    // Each link is reported with the path that reached it, so an ambiguous
    // container names the container rather than the leaf you asked for.
    current = await findOne(current, scope.slice(0, index), step, timeout)
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
  // The errors already carry the scope path, so there is nothing to wrap.
  return findOne(root, scope, selector, timeout)
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
