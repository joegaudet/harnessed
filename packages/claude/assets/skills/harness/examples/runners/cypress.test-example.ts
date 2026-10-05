// A Cypress e2e test. Harness calls are async, so they run inside cy.harness;
// never call cy.* inside the callback. Chai assertions come from
// chai.use(harnessedChai) in cypress/support (@harnessed-ts/chai).
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
