import '@harnessed-ts/cypress/support'
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
