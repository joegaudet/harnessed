import { getConfig } from '@harnessed/core'
import type { Selector } from '@harnessed/core'
import { selectors } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type RoleName = Parameters<Page['getByRole']>[0]

let appliedTestIdAttribute: string | undefined

/** Playwright keeps the test-id attribute in its own global, so ours is pushed across. */
function syncTestIdAttribute(): void {
  const wanted = getConfig().testIdAttribute
  if (wanted !== appliedTestIdAttribute) {
    selectors.setTestIdAttribute(wanted)
    appliedTestIdAttribute = wanted
  }
}

type Scoped = Pick<
  Locator,
  'getByRole' | 'getByLabel' | 'getByTestId' | 'getByText' | 'getByPlaceholder'
>

function step(scope: Scoped, selector: Selector): Locator {
  const found = ((): Locator => {
    switch (selector.type) {
      case 'role':
        return scope.getByRole(selector.role as RoleName, selector.options)
      case 'label':
        return scope.getByLabel(selector.text)
      case 'testId':
        return scope.getByTestId(selector.testId)
      case 'text':
        return scope.getByText(selector.text)
      case 'placeholder':
        return scope.getByPlaceholder(selector.text)
    }
  })()
  return selector.nth === undefined ? found : found.nth(selector.nth)
}

/**
 * Walks the scope chain into a Locator. Nothing is resolved yet — a Locator is a
 * description too, which is why this can be built before the page has rendered.
 */
export function locatorFor(page: Page, scope: readonly Selector[], selector: Selector): Locator {
  syncTestIdAttribute()
  let current: Scoped = page
  for (const link of scope) {
    current = step(current, link)
  }
  return step(current, selector)
}

export function timeoutFor(explicit?: number): number {
  return explicit ?? getConfig().defaultTimeout
}
