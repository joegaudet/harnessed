import { getConfig, testIdPresenceSelector, testIdSync } from '@harnessed-ts/core'
import type { Selector } from '@harnessed-ts/core'
import { selectors } from '@playwright/test'
import type { FrameLocator, Locator, Page } from '@playwright/test'

type RoleName = Parameters<Page['getByRole']>[0]

const syncTestIdAttribute = testIdSync(attribute => selectors.setTestIdAttribute(attribute))

type Scoped = Pick<
  Locator | FrameLocator,
  'getByRole' | 'getByLabel' | 'getByTestId' | 'getByText' | 'getByPlaceholder' | 'locator'
>

function step(scope: Scoped, selector: Selector): Locator {
  const found = ((): Locator => {
    switch (selector.type) {
      case 'role':
        return scope.getByRole(selector.role as RoleName, selector.options)
      case 'label':
        return scope.getByLabel(selector.text)
      case 'testId': {
        // A presence pattern (`data-test-*`) is plain CSS; Playwright's test-id
        // engine only matches an attribute by value.
        const css = testIdPresenceSelector(getConfig().testIdAttribute, selector.testId)
        return css === undefined ? scope.getByTestId(selector.testId) : scope.locator(css)
      }
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
    const found = step(current, link)
    // Cross-origin frames included: Playwright enters out-of-process frames too.
    current = link.frame === true ? found.contentFrame() : found
  }
  return step(current, selector)
}
