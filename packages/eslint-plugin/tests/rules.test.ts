import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import noComponentHarnessInTest from '../src/rules/no-component-harness-in-test'
import noPageOrScreenInHarness from '../src/rules/no-page-or-screen-in-harness'
import noRawLocatorInTest from '../src/rules/no-raw-locator-in-test'
import noReachThroughCast from '../src/rules/no-reach-through-cast'
import requireHost from '../src/rules/require-host'
import requireWaitForReady from '../src/rules/require-wait-for-ready'
import { classifyConstructed, matchesAnyGlob } from '../src/shared'

// RuleTester drives the rules through ESLint itself, so a rule that crashes on a
// shape it did not expect fails here rather than in a consumer's build.
RuleTester.afterAll = () => {}
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
})

describe('no-page-or-screen-in-harness', () => {
  tester.run('no-page-or-screen-in-harness', noPageOrScreenInHarness, {
    valid: [
      {
        name: 'this.page inside waitForReady is the one sanctioned use',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R { async waitForReady() { await this.page.waitForSelector('[data-testid="stage"]') } }`,
      },
      {
        name: "a file outside a harness directory is not this rule's business",
        filename: '/repo/src/app.ts',
        code: `const x = screen.getByRole('button')`,
      },
      {
        name: 'elementBy is the supported escape hatch',
        filename: '/repo/harness/components/Grid.harness.ts',
        code: `class H { cell(i) { return this.elementBy({ type: 'testId', testId: 'c' + i }) } }`,
      },
    ],
    invalid: [
      {
        name: 'this.page in an ordinary method',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R { async price() { return this.page.textContent('.price') } }`,
        errors: [{ messageId: 'noPage' }],
      },
      {
        name: 'the testing-library screen global',
        filename: '/repo/harness/components/Form.harness.ts',
        code: `class H { async title() { return screen.getByRole('heading').textContent } }`,
        errors: [{ messageId: 'noPage' }],
      },
    ],
  })
})

describe('require-host', () => {
  tester.run('require-host', requireHost, {
    valid: [
      {
        name: 'decorated concrete harness',
        filename: '/repo/harness/components/Form.harness.ts',
        code: `@Harness({ host: testId('form') }) class FormHarness extends ComponentHarness {}`,
      },
      {
        name: 'an abstract base may leave the host to its subclasses',
        filename: '/repo/harness/components/Base.harness.ts',
        code: `abstract class BaseHarness extends ComponentHarness { async heading() { return '' } }`,
      },
      {
        name: 'a class that is not a harness',
        filename: '/repo/harness/util.ts',
        code: `class Helper extends Object {}`,
      },
      {
        name: 'an abstract page base may leave the host to its subclasses',
        filename: '/repo/harness/pages/app.page.ts',
        code: `abstract class AppPage extends PageHarness { async heading() { return '' } }`,
      },
      {
        name: 'a decorated concrete page',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `@Harness({ host: testId('page-checkout') }) class CheckoutPage extends PageHarness {}`,
      },
    ],
    invalid: [
      {
        name: 'a concrete page with no decorator',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class CheckoutPage extends PageHarness {}`,
        errors: [{ messageId: 'missing' }],
      },
      {
        name: 'a subclass of a page base (name ending in Page) with no decorator',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class CheckoutPage extends AppPage {}`,
        errors: [{ messageId: 'missing' }],
      },
      {
        name: 'concrete harness with no decorator',
        filename: '/repo/harness/components/Form.harness.ts',
        code: `class FormHarness extends ComponentHarness {}`,
        errors: [{ messageId: 'missing' }],
      },
      {
        name: 'a mixin-style base is still a harness',
        filename: '/repo/harness/components/Form.harness.ts',
        code: `class FormHarness extends ComponentHarness(Base) {}`,
        errors: [{ messageId: 'missing' }],
      },
    ],
  })
})

describe('require-wait-for-ready', () => {
  tester.run('require-wait-for-ready', requireWaitForReady, {
    valid: [
      {
        name: 'a non-empty implementation',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R extends RouteHarness { async waitForReady() { await this.page.waitForSelector('x') } }`,
      },
      {
        name: 'a generic RouteHarness base is still recognised',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R extends RouteHarness<{ token: string }> { async waitForReady() { await this.page.waitForSelector('x') } }`,
      },
      {
        name: 'a page with a non-empty implementation',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class P extends PageHarness { async waitForReady() { await this.self.waitFor('visible') } }`,
      },
      {
        name: 'a generic PageHarness base is recognised',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class P extends PageHarness<{ token: string }> { async waitForReady() { await this.self.waitFor('visible') } }`,
      },
      {
        name: 'an abstract page base may leave waitForReady to its subclasses',
        filename: '/repo/harness/pages/app.page.ts',
        code: `abstract class AppPage extends PageHarness { }`,
      },
    ],
    invalid: [
      {
        name: 'an abstract page base with an empty waitForReady removes the wait from every subclass',
        filename: '/repo/harness/pages/app.page.ts',
        code: `abstract class AppPage extends PageHarness { async waitForReady() {} }`,
        errors: [{ messageId: 'empty' }],
      },
      {
        name: 'a page missing waitForReady entirely',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class P extends PageHarness { }`,
        errors: [{ messageId: 'missing' }],
      },
      {
        name: 'a page without a path still needs the wait',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class P extends PageHarness { async waitForReady() {} }`,
        errors: [{ messageId: 'empty' }],
      },
      {
        name: 'a namespaced page base is still a page',
        filename: '/repo/harness/pages/checkout.page.ts',
        code: `class P extends ns.PageHarness { }`,
        errors: [{ messageId: 'missing' }],
      },
      {
        name: 'missing entirely',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R extends RouteHarness { get path() { return '/' } }`,
        errors: [{ messageId: 'missing' }],
      },
      {
        name: 'present but empty, which removes the wait',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R extends RouteHarness { async waitForReady() {} }`,
        errors: [{ messageId: 'empty' }],
      },
      {
        // The two rules used to recognise different subsets of superclass
        // syntax, so a namespaced base was policed by one and skipped by the
        // other. One predicate now backs both.
        name: 'a namespaced base is still a route',
        filename: '/repo/harness/routes/checkout.route.ts',
        code: `class R extends ns.RouteHarness { get path() { return '/' } }`,
        errors: [{ messageId: 'missing' }],
      },
    ],
  })
})

describe('no-reach-through-cast', () => {
  tester.run('no-reach-through-cast', noReachThroughCast, {
    valid: [
      { name: 'an ordinary cast narrows a type', code: `const p = value as HTMLElement` },
      { name: 'a single cast to unknown', code: `const p = value as unknown` },
      {
        name: 'bridging to a real named type is not breaking encapsulation',
        code: `const n = node as unknown as Rule.Node`,
      },
      {
        name: 'a named type that is then read from is still fine',
        code: `const p = (node as unknown as Rule.Node).parent`,
      },
      {
        name: 'an invented shape that is never read from',
        code: `const p = harness as unknown as { page: Page }`,
      },
    ],
    invalid: [
      {
        name: 'the double cast used to reach protected members',
        code: `const p = (harness as unknown as { page: Page }).page`,
        errors: [{ messageId: 'noCast' }],
      },
    ],
  })
})

describe('no-raw-locator-in-test', () => {
  tester.run('no-raw-locator-in-test', noRawLocatorInTest, {
    valid: [
      {
        name: 'a harness method',
        filename: '/repo/tests/checkout.test.ts',
        code: `const price = await quote.estimate.price()`,
      },
      {
        name: 'raw locators outside a test directory',
        filename: '/repo/src/app.ts',
        code: `page.getByRole('button')`,
      },
      {
        name: 'a same-named method on something that is not page or screen',
        filename: '/repo/tests/checkout.test.ts',
        code: `myThing.locator('x')`,
      },
    ],
    invalid: [
      {
        name: 'page.getByRole in a test',
        filename: '/repo/e2e/steps/checkout.steps.ts',
        code: `await page.getByRole('button', { name: 'Pay' }).click()`,
        errors: [{ messageId: 'raw' }],
      },
      {
        name: 'screen.getByText in a component test',
        filename: '/repo/tests/components/Form.test.tsx',
        code: `screen.getByText('Sign in')`,
        errors: [{ messageId: 'raw' }],
      },
    ],
  })
})

describe('no-component-harness-in-test', () => {
  tester.run('no-component-harness-in-test', noComponentHarnessInTest, {
    valid: [
      {
        name: 'a test enters through a page',
        filename: '/repo/e2e/checkout.spec.ts',
        code: `const checkout = new CheckoutPage(pw(page)); await checkout.goto()`,
      },
      {
        name: 'a route (the deprecated page) is still a page',
        filename: '/repo/e2e/checkout.spec.ts',
        code: `const checkout = new CheckoutRoute(pw(page))`,
      },
      {
        name: 'a test that renders the component itself may construct its harness',
        filename: '/repo/src/Form.test.tsx',
        code: `render(<Form />); const form = new FormHarness(dom({ user }))`,
      },
      {
        name: 'render after the construction still exempts the file',
        filename: '/repo/src/Form.test.tsx',
        code: `const form = new FormHarness(dom({ user })); render(<Form />)`,
      },
      {
        name: 'a namespaced render call counts',
        filename: '/repo/src/Form.test.tsx',
        code: `rtl.render(<Form />); const form = new FormHarness(dom({ user }))`,
      },
      {
        name: 'a Cypress component test mounts the component',
        filename: '/repo/src/Form.cy.tsx',
        code: `cy.mount(<Form />); const form = new FormHarness(env)`,
      },
      {
        name: "a file that is not a test is not this rule's business",
        filename: '/repo/src/app.ts',
        code: `const cart = new CartHarness(env)`,
      },
      {
        name: 'an anonymous class expression is not a named component harness',
        filename: '/repo/e2e/probe.spec.ts',
        code: `const probe = new (class extends ComponentHarness {})(env)`,
      },
      {
        name: 'custom testFiles globs replace the default',
        filename: '/repo/src/Form.test.ts',
        code: `const form = new FormHarness(env)`,
        options: [{ testFiles: ['e2e/**'] }],
      },
      {
        name: 'custom renderCallees replace the default',
        filename: '/repo/src/Form.test.tsx',
        code: `renderWithProviders(<Form />); const form = new FormHarness(env)`,
        options: [{ renderCallees: ['renderWithProviders'] }],
      },
    ],
    invalid: [
      {
        name: 'a component harness constructed in a step file',
        filename: '/repo/e2e/steps/cart.steps.ts',
        code: `world.cart = new CartHarness(pw(page))`,
        errors: [{ messageId: 'enterThroughPage', data: { name: 'CartHarness' } }],
      },
      {
        name: 'a file under a steps directory with no suffix',
        filename: '/repo/features/steps/cart.ts',
        code: `const cart = new CartHarness(pw(page))`,
        errors: [{ messageId: 'enterThroughPage' }],
      },
      {
        name: 'a namespaced component harness in a spec',
        filename: '/repo/tests/cards.spec.ts',
        code: `const grid = new harnesses.CardGridHarness(env)`,
        errors: [{ messageId: 'enterThroughPage', data: { name: 'CardGridHarness' } }],
      },
      {
        name: 'a unit test that constructs a harness without rendering anything',
        filename: '/repo/src/form.test.tsx',
        code: `const form = new FormHarness(env)`,
        errors: [{ messageId: 'enterThroughPage' }],
      },
      {
        name: 'render only mentioned in a string or comment does not exempt',
        filename: '/repo/src/form.test.tsx',
        code: `// render(<Form />)\nconst note = 'render'; const form = new FormHarness(env)`,
        errors: [{ messageId: 'enterThroughPage' }],
      },
      {
        name: 'every construction is reported, not just the first',
        filename: '/repo/e2e/cart.spec.ts',
        code: `const a = new CartHarness(env); const b = new FormHarness(env)`,
        errors: [{ messageId: 'enterThroughPage' }, { messageId: 'enterThroughPage' }],
      },
    ],
  })
})

describe('shared helpers', () => {
  const DEFAULTS = ['**/*.spec.*', '**/*.test.*', '**/*.cy.*', '**/*.steps.*', '**/steps/**']

  it('matchesAnyGlob covers the default test-file shapes', () => {
    expect(matchesAnyGlob('/repo/e2e/foo.spec.ts', DEFAULTS)).toBe(true)
    expect(matchesAnyGlob('/repo/src/foo.test.tsx', DEFAULTS)).toBe(true)
    expect(matchesAnyGlob('/repo/src/foo.cy.tsx', DEFAULTS)).toBe(true)
    expect(matchesAnyGlob('/repo/features/foo.steps.ts', DEFAULTS)).toBe(true)
    expect(matchesAnyGlob('/repo/features/steps/foo.ts', DEFAULTS)).toBe(true)
    expect(matchesAnyGlob('foo.spec.ts', DEFAULTS)).toBe(true)
    expect(matchesAnyGlob('C:\\repo\\e2e\\foo.spec.ts', DEFAULTS)).toBe(true)
  })

  it('matchesAnyGlob leaves ordinary source alone', () => {
    expect(matchesAnyGlob('/repo/src/app.ts', DEFAULTS)).toBe(false)
    expect(matchesAnyGlob('/repo/src/specs.ts', DEFAULTS)).toBe(false)
    expect(matchesAnyGlob('/repo/src/stepsHelper.ts', DEFAULTS)).toBe(false)
  })

  it('matchesAnyGlob honours a single-level star and braces', () => {
    expect(matchesAnyGlob('/repo/e2e/foo.ts', ['e2e/*.ts'])).toBe(true)
    expect(matchesAnyGlob('/repo/e2e/nested/foo.ts', ['e2e/*.ts'])).toBe(false)
    expect(matchesAnyGlob('/repo/e2e/foo.spec.js', ['**/*.{spec,test}.{js,ts}'])).toBe(true)
  })

  it('classifyConstructed tells pages from component harnesses', () => {
    expect(classifyConstructed('CheckoutPage')).toBe('page')
    expect(classifyConstructed('CheckoutRoute')).toBe('page')
    expect(classifyConstructed('PageHarness')).toBe('page')
    expect(classifyConstructed('RouteHarness')).toBe('page')
    expect(classifyConstructed('CartHarness')).toBe('component')
    expect(classifyConstructed('Helper')).toBeUndefined()
  })
})
