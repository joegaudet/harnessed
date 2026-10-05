// A Cypress e2e test. Harness calls are async, so they run inside cy.harness;
// never call cy.* inside the callback.
//
// cy.harness and cy.visitPage are registered by the support file
// (cypress/support/e2e.ts), alongside the Chai assertions:
//
//   import '@harnessed-ts/cypress/support'
//   import { harnessedChai } from '@harnessed-ts/chai'
//   chai.use(harnessedChai)
import { CheckoutPage } from '../harness/checkout.page'

describe('checkout', () => {
  it('paying shows the confirmation', () => {
    cy.visitPage(CheckoutPage, { token: 'abc' })
    cy.harness(CheckoutPage, async checkout => {
      const confirmation = await checkout.pay()
      await expect(confirmation.heading).to.readAs('Thanks!')
    })
  })
})
