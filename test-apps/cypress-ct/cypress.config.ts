import react from '@vitejs/plugin-react'
import { defineConfig } from 'cypress'

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
      // The fixture's harnesses arrive precompiled from the conformance build, so
      // nothing here is decorated and the React plugin is all Vite needs. An app
      // that compiles its own harnesses adds `harnessedDecorators()` from
      // `@harnessed-ts/core/vite`.
      viteConfig: { plugins: [react()] },
    },
    specPattern: 'cypress/component/**/*.cy.tsx',
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
  video: false,
  screenshotOnRunFailure: true,
})
