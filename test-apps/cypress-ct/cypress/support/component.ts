import '@harnessed-ts/cypress/support'
// The catch-all intercept mocks go through, and a reset after every test.
import '@harnessed-ts/cypress/mock'
import { mount } from 'cypress/react'

declare global {
  // Cypress's augmentation point is this global namespace.
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

Cypress.Commands.add('mount', mount)
