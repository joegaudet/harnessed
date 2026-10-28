// Registers cy.harness, cy.harnessEnv and cy.visitPage: the bridge every step runs harnesses through.
import '@harnessed-ts/cypress/support'
// The catch-all intercept mocks go through, and a reset after every scenario.
import '@harnessed-ts/cypress/mock'
