import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor'
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'
import { defineConfig } from 'cypress'

/** The shared harness-world feature, under the Cypress cucumber preprocessor and driver. */
export default defineConfig({
  e2e: {
    // The React fixture, served by `pnpm --filter conformance serve:fixture` on
    // this app's own port so it can run beside the other runners.
    baseUrl: 'http://localhost:5189',
    specPattern: '../../packages/gherkin/features/*.feature',
    supportFile: 'cypress/support/e2e.ts',
    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config)
      on('file:preprocessor', createBundler({ plugins: [createEsbuildPlugin(config)] }))
      return config
    },
  },
  video: false,
  screenshotOnRunFailure: true,
})
