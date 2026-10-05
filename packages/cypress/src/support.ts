/**
 * Import from your support file (`cypress/support/e2e.ts` or `component.ts`) to
 * register `cy.harness`, `cy.harnessEnv` and `cy.visitPage`:
 *
 * ```ts
 * import '@harnessed-ts/cypress/support'
 * ```
 */
import { registerCommands } from './commands'

export type {
  HarnessClass,
  HarnessCommandOptions,
  VisitablePage,
  VisitPageArgs,
  Yielded,
} from './commands'

registerCommands()
