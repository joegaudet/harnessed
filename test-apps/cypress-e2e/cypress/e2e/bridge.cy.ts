import { LoginFormHarness, StepTwoPage } from '@harnessed-ts/conformance'
import { createQuery, navigationFor, testId } from '@harnessed-ts/core'

/** True when `A` and `B` are the same type — checked by `tsc`, which `test` runs first. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** What a chain is declared to yield. */
type YieldOf<C> = C extends Cypress.Chainable<infer S> ? S : never

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

  it('yields undefined, as declared, when the callback resolves nothing and nothing came before', () => {
    const chain = cy.harness(LoginFormHarness, async () => {})
    const declared: Equals<YieldOf<typeof chain>, undefined> = true
    chain.then(subject => {
      expect(declared).to.equal(true)
      expect(subject).to.equal(undefined)
    })
  })

  it('passes the previous subject through, as declared, when the callback resolves nothing', () => {
    const chain = cy.wrap('before').harness(LoginFormHarness, async () => {})
    const declared: Equals<YieldOf<typeof chain>, string> = true
    chain.then(subject => {
      expect(declared).to.equal(true)
      expect(subject).to.equal('before')
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

describe('goto() inside the bridge', () => {
  it('resolves a relative URL against baseUrl, not against the page the AUT is on', () => {
    cy.visit('/nested/route')
    cy.harnessEnv(env => navigationFor(env).goto(env, 'step-two?token=abc123'))
    // Against the AUT's own URL this would be /nested/step-two.
    cy.location('pathname').should('eq', '/step-two')
    cy.location('search').should('eq', '?token=abc123')
  })
})

/**
 * Inputs whose value is not text: Playwright's `fill()` sets these directly, since
 * typing characters into them means nothing.
 */
const DIRECT_VALUES: Record<string, string> = {
  date: '2024-03-15',
  time: '13:45',
  'datetime-local': '2024-03-15T13:45',
  month: '2024-03',
  week: '2024-W11',
  color: '#ff8800',
  range: '30',
}

// realEvents is CDP input, which only Chromium-family browsers have; the refusal
// elsewhere is covered above.
if (Cypress.isBrowser({ family: 'chromium' })) {
  describe('fill() under realEvents, on inputs that take no typing', () => {
    beforeEach(() => {
      cy.visit('/?view=login')
      cy.get('[data-testid="login-form"]')
      cy.document().then(document => {
        for (const type of Object.keys(DIRECT_VALUES)) {
          const input = document.createElement('input')
          input.type = type
          input.dataset.testid = `field-${type}`
          document.body.append(input)
        }
      })
    })

    for (const [type, value] of Object.entries(DIRECT_VALUES)) {
      it(`sets a ${type} input's value directly, then fires input and change`, () => {
        const events: string[] = []
        cy.get(`[data-testid="field-${type}"]`).then($input => {
          for (const name of ['input', 'change']) {
            $input[0].addEventListener(name, () => events.push(name))
          }
        })
        cy.harnessEnv(env => createQuery(env, [], testId(`field-${type}`)).fill(value), {
          realEvents: true,
        })
        cy.get(`[data-testid="field-${type}"]`).should('have.value', value)
        cy.wrap(events).should('deep.equal', ['input', 'change'])
      })
    }

    it('clears a date input the same way', () => {
      cy.harnessEnv(
        async env => {
          const field = createQuery(env, [], testId('field-date'))
          await field.fill(DIRECT_VALUES.date)
          await field.clear()
        },
        { realEvents: true },
      )
      cy.get('[data-testid="field-date"]').should('have.value', '')
    })
  })
}

describe('cy.visitPage', () => {
  it('visits the URL urlFor gives, and yields the page once it is ready', () => {
    cy.visitPage(StepTwoPage, { token: 'abc123' })
      .then(page => page.token())
      .should('eq', 'abc123')
    cy.location('pathname').should('eq', '/step-two')
    cy.location('search').should('eq', '?token=abc123')
  })
})
