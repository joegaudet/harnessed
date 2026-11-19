export interface AssertionDetails {
  actual: unknown
  expected: unknown
  /** False for a failed negation: the values agreed, which was the problem. */
  showDiff: boolean
}

/**
 * Carries `actual`, `expected` and `showDiff` the way Chai's does, which is
 * what Vitest, Mocha, Cypress and Playwright read to render a diff.
 */
export class AssertionError extends Error {
  override name = 'AssertionError'
  readonly actual: unknown
  readonly expected: unknown
  readonly showDiff: boolean

  constructor(message: string, details: AssertionDetails) {
    super(message)
    this.actual = details.actual
    this.expected = details.expected
    this.showDiff = details.showDiff
  }
}
