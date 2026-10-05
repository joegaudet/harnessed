import { LoginFormHarness, StepTwoPage } from '@harnessed-ts/conformance'

/**
 * The commands a user writes, as opposed to the catalog's `cy.harnessEnv`: each
 * one is a single command that yields into the ordinary Cypress chain.
 */
describe('the cy.harness bridge', () => {
  beforeEach(() => {
    cy.visit('/?view=login')
    // The load event comes before React renders; an absence check must not race it.
    cy.get('[data-testid="login-form"]')
  })

  it('yields what the callback resolves to', () => {
    cy.harness(LoginFormHarness, form => form.heading()).should('eq', 'Sign in')
  })

  it('yields the harness itself when there is no callback', () => {
    cy.harness(LoginFormHarness)
      .then(form => form.heading())
      .should('eq', 'Sign in')
  })

  it('runs @harnessed-ts/chai assertions inside the callback', () => {
    cy.harness(LoginFormHarness, async form => {
      await form.fillIn({ email: 'ada@example.com' })
      await expect(form).not.to.be.absent
      expect(await form.values()).to.deep.equal({ email: 'ada@example.com', password: '' })
    })
  })

  it('fails the test with the assertion the callback rejects with', () => {
    cy.on('fail', error => {
      expect(error.message).to.match(/to be absent/)
      return false
    })
    cy.harness(LoginFormHarness, async form => {
      await expect(form).to.be.absent
    })
    // Reached only if the bridge swallowed the rejection; the handler above then
    // sees this message instead and fails the test.
    cy.then(() => {
      throw new Error('the bridge did not fail')
    })
  })

  it('outlives the 4 s Cypress gives a plain then(): its budget is defaultTimeout × 4', () => {
    cy.harness(LoginFormHarness, async form => {
      await new Promise(resolve => setTimeout(resolve, 4_500))
      return form.heading()
    }).should('eq', 'Sign in')
  })

  it('drives the page with user-event by default: synthetic, untrusted events', () => {
    const trusted: boolean[] = []
    cy.document().then(document => {
      document.addEventListener('click', event => trusted.push(event.isTrusted))
    })
    cy.harness(LoginFormHarness, form => form.rememberMe())
    cy.wrap(trusted).should('deep.equal', [false])
  })

  it('drives the page with trusted browser input under realEvents, on Chromium only', () => {
    if (!Cypress.isBrowser({ family: 'chromium' })) {
      cy.on('fail', error => {
        expect(error.message).to.match(/Chromium-family browsers/)
        return false
      })
      cy.harness(LoginFormHarness, form => form.rememberMe(), { realEvents: true })
      cy.then(() => {
        throw new Error('realEvents did not refuse')
      })
      return
    }
    const trusted: boolean[] = []
    cy.document().then(document => {
      document.addEventListener('click', event => trusted.push(event.isTrusted))
    })
    cy.harness(LoginFormHarness, form => form.rememberMe(), { realEvents: true })
    cy.wrap(trusted).should('deep.equal', [true])
    cy.harness(LoginFormHarness, form => form.isRemembered()).should('eq', true)
  })
})

describe('cy.visitPage', () => {
  it('visits the URL urlFor gives, and yields the page once it is ready', () => {
    cy.visitPage(StepTwoPage, { token: 'abc123' })
      .then(page => page.token())
      .should('eq', 'abc123')
    cy.location('pathname').should('eq', '/step-two')
    cy.location('search').should('eq', '?token=abc123')
  })
})
