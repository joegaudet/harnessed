/**
 * A shim for one release. `withWorld` moved to `@harnessed-ts/gherkin/playwright-bdd`,
 * beside the world, page registry and `{page}` parameter type every Gherkin
 * runner shares; this entry point is removed in the next minor.
 */
export {
  /** @deprecated Import from `@harnessed-ts/gherkin/playwright-bdd`. Removed in the next minor. */
  withWorld,
} from '@harnessed-ts/gherkin/playwright-bdd'
export type {
  /** @deprecated Import from `@harnessed-ts/gherkin/playwright-bdd`. Removed in the next minor. */
  WithWorld,
  /** @deprecated Import from `@harnessed-ts/gherkin/playwright-bdd`. Removed in the next minor. */
  WorldFixture,
} from '@harnessed-ts/gherkin/playwright-bdd'
