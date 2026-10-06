import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // The Ember port of the fixture, built and served by
    // `pnpm --filter test-app-ember-vite serve:fixture` on this app's own port.
    baseUrl: 'http://localhost:5191',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
  video: false,
  screenshotOnRunFailure: true,
})
