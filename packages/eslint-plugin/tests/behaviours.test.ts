import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index'
import behaviouralMethodNames from '../src/rules/behavioural-method-names'
import harnessPublicSurface from '../src/rules/harness-public-surface'
import noRunnerImportInHarness from '../src/rules/no-runner-import-in-harness'

// Harnesses speak in behaviours, never in the vocabulary of a test runner or the
// DOM. These rules are what keeps a test portable to a new variant of the app: a
// native build needs new harnesses, not new tests.
RuleTester.afterAll = () => {}
RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
})

const HARNESS = '/repo/harness/components/Form.harness.ts'
const PAGE = '/repo/harness/pages/checkout.page.ts'

describe('no-runner-import-in-harness', () => {
  tester.run('no-runner-import-in-harness', noRunnerImportInHarness, {
    valid: [
      {
        name: 'the harness API itself',
        filename: HARNESS,
        code: `import { ComponentHarness, Harness, testId } from '@harnessed-ts/core'`,
      },
      {
        name: 'the page base',
        filename: PAGE,
        code: `import { PageHarness } from '@harnessed-ts/page'`,
      },
      {
        name: 'the deprecated route package is still a page base',
        filename: PAGE,
        code: `import { RouteHarness } from '@harnessed-ts/route'`,
      },
      {
        name: 'another harness, by relative path',
        filename: PAGE,
        code: `import { CardGridHarness } from '../components/CardGrid.harness'`,
      },
      {
        name: "the app's own domain types",
        filename: HARNESS,
        code: `import type { Plan } from '../../src/billing/plan'\nimport type { User } from '@acme/app'`,
      },
      {
        name: "a file outside a harness directory is not this rule's business",
        filename: '/repo/e2e/checkout.spec.ts',
        code: `import { expect, test } from '@playwright/test'\nconst body = document.body`,
      },
      {
        name: 'allow names a module the repo has decided to accept',
        filename: HARNESS,
        code: `import { expect } from 'vitest'`,
        options: [{ allow: ['vitest'] }],
      },
      {
        name: 'allow takes a scope wildcard',
        filename: HARNESS,
        code: `import { within } from '@testing-library/dom'`,
        options: [{ allow: ['@testing-library/*'] }],
      },
      {
        name: "a page's own waitForReady may ask the document whether it has arrived",
        filename: PAGE,
        code: `class P extends PageHarness { protected async waitForReady() { await until(() => document.readyState === 'complete') } }`,
      },
      {
        name: 'a page base extended by name still counts as a page',
        filename: PAGE,
        code: `class P extends AppPage { protected async waitForReady() { await until(() => window.appReady) } }`,
      },
      {
        name: 'a local binding that shares a global name is not the global',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async names(browser) { const $ = s => s; return $(browser) } }`,
      },
      {
        name: 'an empty export and a computed dynamic import',
        filename: HARNESS,
        code: `export {}\nconst lib = await import(name)`,
      },
      {
        name: 'a member or method named like a global is not the global',
        filename: HARNESS,
        code: `class H extends ComponentHarness { window() { return this.document.cy } }`,
      },
    ],
    invalid: [
      ...[
        '@playwright/test',
        'playwright',
        'cypress',
        '@testing-library/react',
        '@testing-library/user-event',
        'webdriverio',
        'puppeteer',
        'testcafe',
        'vitest',
        '@vitest/expect',
        '@ember/test-helpers',
        'qunit',
        'chai',
        '@harnessed-ts/dom',
        '@harnessed-ts/playwright',
        '@harnessed-ts/playwright/bdd',
      ].map(source => ({
        name: `an import from ${source}`,
        filename: HARNESS,
        code: `import { x } from '${source}'`,
        errors: [{ messageId: 'runnerImport', data: { source } }],
      })),
      {
        name: 'a driver this rule has never heard of: only core, page and route are allowed',
        filename: HARNESS,
        code: `import { xcuitest } from '@harnessed-ts/xcuitest'`,
        errors: [{ messageId: 'runnerImport' }],
      },
      {
        name: 'a type-only import still brings the vocabulary in',
        filename: HARNESS,
        code: `import type { Locator } from '@playwright/test'`,
        errors: [{ messageId: 'runnerImport' }],
      },
      {
        name: 'a re-export',
        filename: HARNESS,
        code: `export { expect } from 'vitest'`,
        errors: [{ messageId: 'runnerImport' }],
      },
      {
        name: 'an export-all',
        filename: HARNESS,
        code: `export * from '@testing-library/dom'`,
        errors: [{ messageId: 'runnerImport' }],
      },
      {
        name: 'a dynamic import',
        filename: HARNESS,
        code: `const lib = await import('@testing-library/dom')`,
        errors: [{ messageId: 'runnerImport' }],
      },
      {
        name: 'a TypeScript import-equals',
        filename: HARNESS,
        code: `import pw = require('playwright')`,
        errors: [{ messageId: 'runnerImport', data: { source: 'playwright' } }],
      },
      {
        name: 'a require call',
        filename: HARNESS,
        code: `const { expect } = require('@playwright/test')`,
        errors: [{ messageId: 'runnerImport', data: { source: '@playwright/test' } }],
      },
      {
        name: 'a dynamic import of a template literal with no substitutions',
        filename: HARNESS,
        code: 'const lib = await import(`playwright`)',
        errors: [{ messageId: 'runnerImport', data: { source: 'playwright' } }],
      },
      ...['chai-as-promised', 'jest-axe'].map(source => ({
        name: `a runner plugin, ${source}`,
        filename: HARNESS,
        code: `import x from '${source}'`,
        errors: [{ messageId: 'runnerImport', data: { source } }],
      })),
      {
        name: 'a global reached through globalThis',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async act() { return globalThis.document.body } }`,
        errors: [{ messageId: 'runnerGlobal', data: { name: 'document' } }],
      },
      {
        // WebdriverIO and Cypress setups declare their globals in config, so the
        // reference resolves to a variable with no definition in the file.
        name: 'a global the config declares',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async act() { await browser.$('#x').click() } }`,
        languageOptions: { globals: { browser: 'readonly' } },
        errors: [{ messageId: 'runnerGlobal', data: { name: 'browser' } }],
      },
      {
        name: 'allow exempts only what it names',
        filename: HARNESS,
        code: `import { expect } from 'vitest'\nimport { screen } from '@testing-library/dom'`,
        options: [{ allow: ['vitest'] }],
        errors: [{ messageId: 'runnerImport', data: { source: '@testing-library/dom' } }],
      },
      ...[
        ['cy', `cy.get('[data-testid=x]').click()`],
        ['browser', `await browser.$('#x').click()`],
        ['$', `await $('#x').click()`],
        ['$$', `const rows = await $$('.row')`],
        ['document', `return document.querySelector('.price').textContent`],
        ['window', `window.scrollTo(0, 0)`],
      ].map(([name, statement]) => ({
        name: `the ${name} global inside a harness method`,
        filename: HARNESS,
        code: `class H extends ComponentHarness { async act() { ${statement} } }`,
        errors: [{ messageId: 'runnerGlobal', data: { name } }],
      })),
      {
        name: "a component harness has no waitForReady exemption: it is a page's",
        filename: HARNESS,
        code: `class H extends ComponentHarness { async waitForReady() { await until(() => document.body) } }`,
        errors: [{ messageId: 'runnerGlobal', data: { name: 'document' } }],
      },
      {
        name: "a page's ordinary method gets no exemption",
        filename: PAGE,
        code: `class P extends PageHarness { async total() { return document.title } }`,
        errors: [{ messageId: 'runnerGlobal', data: { name: 'document' } }],
      },
      {
        name: 'every reference is reported',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async act() { document.body; document.title } }`,
        errors: [{ messageId: 'runnerGlobal' }, { messageId: 'runnerGlobal' }],
      },
    ],
  })
})

describe('harness-public-surface', () => {
  tester.run('harness-public-surface', harnessPublicSurface, {
    valid: [
      {
        name: 'private and protected element fields behind behavioural methods',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          @ByRole('button', { name: 'Pay' }) private accessor payButton!: Query
          @ByTestId('total') protected accessor totalLine!: Query
          async pay(): Promise<void> { await this.payButton.click() }
          async total(): Promise<string> { return this.totalLine.text() }
        }`,
      },
      {
        name: 'an ES private element field',
        filename: HARNESS,
        code: `class H extends ComponentHarness { @ByLabel('Email') accessor #email!: Query }`,
      },
      {
        // A child harness speaks in behaviours too, so exposing one is how a page
        // composes its components: \`checkout.cart.lineItems()\`.
        name: 'a public @ChildHarness is a harness, not an element',
        filename: PAGE,
        code: `class P extends PageHarness {
          @ChildHarness(CartHarness) accessor cart!: CartHarness
          cartAt(index: number): CartHarness { return this.cart.nth(index) }
          firstCart(): CartHarness { return this.cart }
        }`,
      },
      {
        name: 'returning what an element says, not the element',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          @ByTestId('error') private accessor errorLine!: Query
          async errorMessage(): Promise<string | null> {
            if (await this.errorLine.isAbsent()) return null
            return this.errorLine.text()
          }
        }`,
      },
      {
        name: 'a private or protected member may traffic in elements',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          private cell(row: number, selector: Selector): Query { return this.elementBy(selector).nth(row) }
          protected get host(): Query { return this.self }
          async #raw(): Promise<Locator> { return this.self }
        }`,
      },
      {
        name: 'a nested function returning an element is not the method returning one',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          async pressedStates(): Promise<boolean[]> {
            return this.cards.map(async card => { const q = this.self; return q.isChecked() })
          }
        }`,
      },
      {
        name: "an app type that shares a runner type's name is the app's",
        filename: HARNESS,
        code: `import type { Query } from '../../src/search'
        class H extends ComponentHarness {
          async lastQuery(): Promise<Query> { return parse(await this.line.text()) }
          async search(query: Query): Promise<void> {}
        }`,
      },
      {
        name: 'public fields that hold domain values, and a private one that holds an element',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          readonly name = 'checkout'
          total = async () => this.line.text()
          private readonly host = this.self
        }`,
      },
      {
        name: 'domain parameters',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async choose(plan: Plan, label: string, { quantity }: Order) {} }`,
      },
      {
        name: 'a constructor is plumbing, not surface',
        filename: HARNESS,
        code: `class H extends ComponentHarness { constructor(env: EnvConfig, selector: Selector) { super(env) } }`,
      },
      {
        name: 'a class that is not a harness',
        filename: HARNESS,
        code: `class Helper { @ByTestId('x') accessor line!: Query; get q(): Query { return this.line } }`,
      },
      {
        name: "a file outside a harness directory is not this rule's business",
        filename: '/repo/src/app.ts',
        code: `class H extends ComponentHarness { @ByTestId('x') accessor line!: Query }`,
      },
    ],
    invalid: [
      {
        name: 'an element field with no modifier is public',
        filename: HARNESS,
        code: `class H extends ComponentHarness { @ByRole('button') accessor pay!: Query }`,
        errors: [{ messageId: 'publicElementField', data: { name: 'pay' } }],
      },
      {
        name: 'an explicitly public element field',
        filename: HARNESS,
        code: `class H extends ComponentHarness { @ByTestId('total') public accessor total!: Query }`,
        errors: [{ messageId: 'publicElementField' }],
      },
      {
        name: 'every element decorator, namespaced or not, plain property or accessor',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          @ByLabel('Email') accessor email!: Query
          @ByText('Hi') accessor greeting!: Query
          @core.ByPlaceholder('you@') accessor hint!: Query
          @ByTestId('x') line!: Query
        }`,
        errors: [
          { messageId: 'publicElementField', data: { name: 'email' } },
          { messageId: 'publicElementField', data: { name: 'greeting' } },
          { messageId: 'publicElementField', data: { name: 'hint' } },
          { messageId: 'publicElementField', data: { name: 'line' } },
        ],
      },
      {
        name: 'a getter that hands out a decorated element',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          @ByTestId('error') private accessor errorLine!: Query
          get errorQuery(): Query { return this.errorLine }
        }`,
        errors: [
          { messageId: 'elementReturnType', data: { method: 'errorQuery', type: 'Query' } },
          { messageId: 'returnsElement', data: { method: 'errorQuery' } },
        ],
      },
      {
        name: 'a computed element, narrowed, behind a Promise',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          async lastRow(): Promise<Query> { return this.elementBy(testId('row')).last() }
        }`,
        errors: [
          { messageId: 'elementReturnType', data: { method: 'lastRow', type: 'Query' } },
          { messageId: 'returnsElement', data: { method: 'lastRow' } },
        ],
      },
      ...[
        'Locator',
        'ElementHandle',
        'Element[]',
        'HTMLInputElement',
        'Promise<Locator | null>',
        'Cypress.Chainable<JQuery>',
        'Selector',
      ].map(type => ({
        name: `a public return type of ${type}`,
        filename: HARNESS,
        code: `class H extends ComponentHarness { handle(): ${type} { return lookup() } }`,
        errors: [{ messageId: 'elementReturnType' }],
      })),
      {
        name: "Query imported from the harness API is the harness API's",
        filename: HARNESS,
        code: `import type { Query } from '@harnessed-ts/core'
        class H extends ComponentHarness { row(): Query { return lookup() } }`,
        errors: [{ messageId: 'elementReturnType' }],
      },
      {
        name: 'an undecorated public field holding an element',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          readonly submit = this.elementBy(testId('submit'))
          readonly total: Query = this.self
        }`,
        errors: [
          { messageId: 'publicElementField', data: { name: 'submit' } },
          { messageId: 'publicElementField', data: { name: 'total' } },
        ],
      },
      {
        name: 'an arrow-function field is a method',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          open = () => this.self
          close = (): Locator => { return this.self }
        }`,
        errors: [
          { messageId: 'returnsElement', data: { method: 'open' } },
          { messageId: 'elementReturnType', data: { method: 'close', type: 'Locator' } },
          { messageId: 'returnsElement', data: { method: 'close' } },
        ],
      },
      {
        name: 'an element behind a conditional or a fallback',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          pick(c) { return c ? this.self : null }
          either() { return this.cached ?? this.self }
        }`,
        errors: [
          { messageId: 'returnsElement', data: { method: 'pick' } },
          { messageId: 'returnsElement', data: { method: 'either' } },
        ],
      },
      {
        name: 'an abstract member and a class expression',
        filename: HARNESS,
        code: `abstract class B extends ComponentHarness { abstract row(): Query }
        const C = class extends ComponentHarness { @ByTestId('x') accessor line!: Query }`,
        errors: [{ messageId: 'elementReturnType' }, { messageId: 'publicElementField' }],
      },
      {
        name: 'a rest parameter of selectors',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async open(...targets: Selector[]) {} }`,
        errors: [{ messageId: 'elementParameter', data: { method: 'open', param: 'targets' } }],
      },
      {
        name: 'returning this.self with no annotation',
        filename: HARNESS,
        code: `class H extends ComponentHarness { host() { return this.self } }`,
        errors: [{ messageId: 'returnsElement', data: { method: 'host' } }],
      },
      {
        name: 'returning elementBy with no annotation',
        filename: HARNESS,
        code: `class H extends ComponentHarness { row(i) { return this.elementBy(testId('row-' + i)) } }`,
        errors: [{ messageId: 'returnsElement' }],
      },
      {
        name: 'returning a private element field, narrowed and awaited',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          @ByTestId('row') private accessor rows!: Query
          async firstRow() { return await this.rows.first() }
        }`,
        errors: [{ messageId: 'returnsElement', data: { method: 'firstRow' } }],
      },
      {
        name: 'a parameter typed as a selector or an element',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async open(target: Selector) {} async drop(on: Query) {} }`,
        errors: [
          { messageId: 'elementParameter', data: { method: 'open', param: 'target' } },
          { messageId: 'elementParameter', data: { method: 'drop', param: 'on' } },
        ],
      },
      ...['selector', 'testId', 'css', 'xpath', 'locator'].map(param => ({
        name: `a parameter named ${param}`,
        filename: HARNESS,
        code: `class H extends ComponentHarness { async open(${param}: string = '') {} }`,
        errors: [{ messageId: 'elementParameter', data: { method: 'open', param } }],
      })),
    ],
  })
})

describe('behavioural-method-names', () => {
  tester.run('behavioural-method-names', behaviouralMethodNames, {
    valid: [
      {
        name: 'methods named for intent',
        filename: HARNESS,
        code: `class H extends ComponentHarness {
          async submit() {} async signIn(email) {} async chooseCard(label) {}
          async errorMessage() {} async typeaheadSuggestions() {} async findings() {}
          get total() { return '' }
        }`,
      },
      {
        name: 'a private or protected helper may be mechanical',
        filename: HARNESS,
        code: `class H extends ComponentHarness { private async clickSubmit() {} protected async fillEmailInput() {} async #tap() {} }`,
      },
      {
        name: 'allow exempts a name the repo has accepted',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async clickThrough() {} }`,
        options: [{ allow: ['clickThrough'] }],
      },
      {
        name: 'verbs replaces the default list',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async clickRow() {} }`,
        options: [{ verbs: ['tap'] }],
      },
      {
        name: 'a class that is not a harness',
        filename: HARNESS,
        code: `class Helper { clickSubmitButton() {} }`,
      },
      {
        name: "a file outside a harness directory is not this rule's business",
        filename: '/repo/src/app.ts',
        code: `class H extends ComponentHarness { clickSubmitButton() {} }`,
      },
    ],
    invalid: [
      ...[
        ['clickSubmit', 'click'],
        ['tap', 'tap'],
        ['hoverMenu', 'hover'],
        ['fillEmail', 'fill'],
        ['typeInto', 'type'],
        ['pressEnter', 'press'],
        ['scrollToBottom', 'scroll'],
        ['focusSearch', 'focus'],
        ['blurEmail', 'blur'],
        ['findRow', 'find'],
        ['doubleClickRow', 'doubleClick'],
      ].map(([method, verb]) => ({
        name: `${method} starts with the mechanical verb ${verb}`,
        filename: HARNESS,
        code: `class H extends ComponentHarness { async ${method}() {} }`,
        errors: [{ messageId: 'mechanicalVerb', data: { name: method, verb } }],
      })),
      ...[
        ['submitButton', 'Button'],
        ['emailInput', 'Input'],
        ['nameField', 'Field'],
        ['wrapperDiv', 'Div'],
        ['getSubmitElement', 'Element'],
        ['rowLocator', 'Locator'],
        ['rowSelector', 'Selector'],
        ['rowTestId', 'TestId'],
        ['headerCss', 'Css'],
        ['button', 'Button'],
      ].map(([method, noun]) => ({
        name: `${method} names the DOM noun ${noun}`,
        filename: HARNESS,
        code: `class H extends ComponentHarness { async ${method}() {} }`,
        errors: [{ messageId: 'domNoun', data: { name: method, noun } }],
      })),
      {
        name: 'one report per method, even when it is wrong twice',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async clickSubmitButton() {} }`,
        errors: [{ messageId: 'mechanicalVerb' }],
      },
      {
        name: 'an arrow-function field is a method',
        filename: HARNESS,
        code: `class H extends ComponentHarness { clickSubmit = async () => {}; readonly submitButtonLabel = 'Pay' }`,
        errors: [{ messageId: 'mechanicalVerb', data: { name: 'clickSubmit', verb: 'click' } }],
      },
      {
        name: 'an abstract method',
        filename: HARNESS,
        code: `abstract class H extends ComponentHarness { abstract clickSubmit(): Promise<void> }`,
        errors: [{ messageId: 'mechanicalVerb' }],
      },
      {
        name: 'a public getter',
        filename: PAGE,
        code: `class P extends PageHarness { get submitButton() { return '' } }`,
        errors: [{ messageId: 'domNoun' }],
      },
      {
        name: 'nouns replaces the default list',
        filename: HARNESS,
        code: `class H extends ComponentHarness { async cartWidget() {} async submitButton() {} }`,
        options: [{ nouns: ['Widget'] }],
        errors: [{ messageId: 'domNoun', data: { name: 'cartWidget', noun: 'Widget' } }],
      },
    ],
  })
})

describe('the configs', () => {
  const recommended = plugin.configs.recommended as { rules: Record<string, string> }
  const strict = plugin.configs.strict as { rules: Record<string, string> }

  it('registers every new rule', () => {
    for (const name of [
      'no-runner-import-in-harness',
      'harness-public-surface',
      'behavioural-method-names',
    ]) {
      expect(plugin.rules[name]).toBeDefined()
    }
  })

  it('errors on runner imports and element surface; warns on names, which are a heuristic', () => {
    for (const config of [recommended, strict]) {
      expect(config.rules['harnessed/no-runner-import-in-harness']).toBe('error')
      expect(config.rules['harnessed/harness-public-surface']).toBe('error')
      expect(config.rules['harnessed/behavioural-method-names']).toBe('warn')
    }
  })
})
