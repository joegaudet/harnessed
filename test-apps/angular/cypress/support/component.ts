// The JIT compiler, for any library Vite served without linking it. This app's
// components are compiled ahead of time by the Angular plugin.
import '@angular/compiler'
import '@harnessed-ts/cypress/support'
import { mount } from 'cypress/angular'

declare global {
  // Cypress's augmentation point is this global namespace.
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

Cypress.Commands.add('mount', mount)
