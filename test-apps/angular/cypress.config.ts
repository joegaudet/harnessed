import { devServer } from '@cypress/vite-dev-server'
import { defineConfig } from 'cypress'
import { plugins } from './vite.shared.ts'

export default defineConfig({
  component: {
    // Cypress's own `framework: 'angular'` builds with the Angular CLI's
    // webpack builder. This app builds with Vite, so the dev server is Vite's,
    // with the same plugins as the app; `cypress/angular` mounts through
    // TestBed whichever bundler served it.
    devServer: devServerConfig =>
      devServer({ ...devServerConfig, viteConfig: { plugins: plugins('tsconfig.cypress.json') } }),
    specPattern: 'cypress/component/**/*.cy.ts',
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
  video: false,
  screenshotOnRunFailure: true,
})
