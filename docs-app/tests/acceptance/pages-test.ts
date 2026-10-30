import { module, test } from 'qunit'
import { setupApplicationTest } from 'docs-app/tests/helpers'
import { visit, waitFor, find } from '@ember/test-helpers'

/** Every guide page, as `<folder>/<page>.md`; each must render without an error. */
const PAGES = [
  'getting-started/introduction.md',
  'getting-started/support-matrix.md',
  'getting-started/see-it-run.md',
  'getting-started/installation.md',
  'writing-harnesses/selectors.md',
  'writing-harnesses/queries.md',
  'writing-harnesses/component-harnesses.md',
  'writing-harnesses/page-harnesses.md',
  'writing-harnesses/matchers.md',
  'writing-harnesses/configuration.md',
  'writing-harnesses/cross-driver-guarantees.md',
  'mocking/mocking-apis.md',
  'mocking/create-api-stubs.md',
  'runners/testing-library.md',
  'runners/node-test.md',
  'runners/bun.md',
  'runners/playwright.md',
  'runners/cypress.md',
  'runners/webdriverio.md',
  'runners/vitest-browser.md',
  'runners/puppeteer.md',
  'runners/testcafe.md',
  'runners/nightwatch.md',
  'frameworks/react.md',
  'frameworks/ember.md',
  'frameworks/vue.md',
  'frameworks/solid.md',
  'frameworks/svelte.md',
  'frameworks/angular.md',
  'storybook-and-bdd/storybook.md',
  'storybook-and-bdd/gherkin.md',
  'tooling/eslint-plugin.md',
  'tooling/packages.md',
  'tooling/adding-a-driver.md',
  'tooling/requirements.md',
]

module('Acceptance | guide pages', function (hooks) {
  setupApplicationTest(hooks)

  for (const page of PAGES) {
    test(`${page} renders`, async function (assert) {
      await visit(`/${page}`)
      await waitFor('.guide-prose h1, .guide-error', { timeout: 15000 })
      const error = find('.guide-error')?.textContent?.trim()
      assert.notOk(error, `page error: ${error}`)
      assert
        .dom('.guide-prose h1')
        .exists(
          (document.querySelector('.guide-main')?.textContent ?? '')
            .replace(/\s+/g, ' ')
            .slice(0, 600),
        )
      // Every code block's language has a grammar loaded in app/highlight.ts.
      const plain = [...document.querySelectorAll('.guide-prose pre:not(.shiki) code')]
      assert.deepEqual(
        plain.map(code => code.className),
        [],
        'code blocks Shiki left unhighlighted',
      )
      // Every <Example> on the page found its file.
      for (const example of document.querySelectorAll('[data-test-example]')) {
        assert
          .dom(example.querySelector('.example-preview'))
          .exists(example.getAttribute('data-test-example')!)
      }
    })
  }

  test('a section link lands on a heading that links to itself', async function (assert) {
    await visit('/getting-started/installation.md#required-setup')
    await waitFor('.guide-prose #required-setup a.heading-anchor', { timeout: 15000 })
    assert.dom('#required-setup a.heading-anchor').hasAttribute('href', '#required-setup')
  })
})
