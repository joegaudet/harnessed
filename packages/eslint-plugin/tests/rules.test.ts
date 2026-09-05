import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'
import noPageOrScreenInHarness from '../src/rules/no-page-or-screen-in-harness'
import noRawLocatorInTest from '../src/rules/no-raw-locator-in-test'
import noReachThroughCast from '../src/rules/no-reach-through-cast'
import requireHost from '../src/rules/require-host'
import requireWaitForReady from '../src/rules/require-wait-for-ready'

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
    ],
    invalid: [
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
    ],
    invalid: [
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
