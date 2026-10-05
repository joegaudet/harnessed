---
'@harnessed-ts/eslint-plugin': minor
---

`no-raw-locator-in-test` and `no-page-or-screen-in-harness` now recognise every supported runner's raw queries: Cypress (`cy.get`, `cy.contains`, `cy.findBy*`), Ember (`find`/`findAll`, test-helpers actions given a selector string, `this.element.querySelector`, `assert.dom('…')`), WebdriverIO (`$`/`$$`, imported or the testrunner's globals, `browser.$`), Puppeteer (`page.$`, `page.$$eval`, `page.waitForSelector`) and TestCafe (`Selector`). Each is matched by import source, so same-named functions from elsewhere are left alone. The default test directories add `test/` and `cypress/`.
