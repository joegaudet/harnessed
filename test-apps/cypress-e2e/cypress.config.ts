import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // The React fixture, served by `pnpm --filter conformance serve:fixture` on
    // this app's own port so it can run beside the other drivers' runners.
    baseUrl: 'http://localhost:5181',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
  video: false,
  screenshotOnRunFailure: true,
})
