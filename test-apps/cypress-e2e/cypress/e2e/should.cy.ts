import { LoginFormHarness, viewSearch } from '@harnessed-ts/conformance'
import { getConfig } from '@harnessed-ts/core'

/**
 * `.should` inside `cy.harness`, as a Cypress user writes it. The support file
 * turns `retryAssertions` on, so a should assertion retries the way Cypress's
 * own `.should` does — until the page catches up or `defaultTimeout` runs out.
 */
describe('should assertions under Cypress', () => {
  it('retries by default, because the support file turns it on', () => {
    expect(getConfig().retryAssertions).to.equal(true)
  })

  it('waits for nodes that render late', () => {
    cy.visit(`/${viewSearch('login-late-duplicates')}`)
    cy.get('[data-testid="login-form"]')
    cy.harness(LoginFormHarness, async form => {
      await form.lateCount.should.equal(2)
    })
  })

  it('reads a method and a target', () => {
    cy.visit(`/${viewSearch('login-error')}`)
    cy.get('[data-testid="login-form"]')
    cy.harness(LoginFormHarness, async form => {
      await form.errorText.should.equal('Bad credentials')
      await form.errorText().should.match(/credentials/)
      await form.errorQuery.should.readAs(/credentials/)
      await form.should.not.be.absent()
    })
  })
})
