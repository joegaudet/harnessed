// Registers cy.harnessEnv. Each framework's spec calls its own `mount` (from
// `cypress/vue` or `cypress/svelte`) directly rather than through a `cy.mount`
// command: the two adapters' types cannot share one `Chainable.mount`.
import '@harnessed-ts/cypress/support'
