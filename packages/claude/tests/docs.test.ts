import { describe, expect, it } from 'vitest'
import { runnersSection } from '../src/render'

describe('the generated runners section', () => {
  it('tells a Cypress repo to import the support file that registers the commands', () => {
    expect(runnersSection(['cypress'])).toContain("import '@harnessed-ts/cypress/support'")
  })

  it('registers the Puppeteer matchers with Vitest, and says how under Jest', () => {
    const section = runnersSection(['puppeteer'])
    expect(section).not.toMatch(/Vitest or Jest/)
    expect(section).toContain('expect.extend(harnessMatchers)')
    expect(section).toContain('@harnessed-ts/core')
  })

  it('tells an Angular repo how its env settles and where harness decorators come from', () => {
    const section = runnersSection(['angular'])
    expect(section).toContain('angular({ fixture })')
    expect(section).toContain('whenStable()')
    expect(section).toContain('experimentalDecorators')
  })

  it("asserts through Chai's own expect under Nightwatch", () => {
    const section = runnersSection(['nightwatch'])
    expect(section).toContain('nightwatch(browser)')
    expect(section).toContain('chai.use(harnessedChai)')
  })

  it('shows the Gherkin entry point for each adapter in use, and only those', () => {
    const section = runnersSection(['gherkin'], { gherkinAdapters: ['cucumber', 'yadda'] })
    expect(section).toContain('@harnessed-ts/gherkin/cucumber')
    expect(section).toContain('HarnessedWorld')
    expect(section).toContain('@harnessed-ts/gherkin/yadda')
    expect(section).toContain('yaddaWorld')
    expect(section).not.toContain('@harnessed-ts/gherkin/playwright-bdd')
    expect(section).not.toContain('@harnessed-ts/gherkin/cypress')
  })

  it('shows the Vitest assertion path for Ember when the repo runs Vitest', () => {
    const section = runnersSection(['ember'], { emberUnderVitest: true })
    expect(section).toContain('assert.harness')
    expect(section).toContain('chai.use(harnessedChai)')
    expect(section).toMatch(/to\.readAs/)
  })

  it('keeps the Ember section to QUnit when the repo has no Vitest', () => {
    expect(runnersSection(['ember'])).not.toMatch(/harnessedChai/)
  })
})
