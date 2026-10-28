import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'cypress'

/**
 * One Cypress project, one component dev server per framework port of the
 * fixture. `CYPRESS_FRAMEWORK` picks the framework, so each is its own CI matrix
 * entry; Solid has none (Cypress ships no Solid mount adapter).
 */
const FRAMEWORKS = {
  // `harnessedDecorators()` first, as in any app that compiles its own harnesses.
  // The fixture's harnesses arrive precompiled from the conformance build; the
  // ports' components are what the framework plugin compiles.
  vue: () => [harnessedDecorators(), vue()],
  svelte: () => [harnessedDecorators(), svelte()],
} as const

type Framework = keyof typeof FRAMEWORKS

const framework = (process.env.CYPRESS_FRAMEWORK || 'vue') as Framework
if (!(framework in FRAMEWORKS)) {
  throw new Error(
    `CYPRESS_FRAMEWORK is "${framework}"; known: ${Object.keys(FRAMEWORKS).join(', ')}`,
  )
}

export default defineConfig({
  component: {
    devServer: {
      framework,
      bundler: 'vite',
      viteConfig: { plugins: FRAMEWORKS[framework]() },
    },
    specPattern: `cypress/component/${framework}/**/*.cy.ts`,
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
  video: false,
  screenshotOnRunFailure: true,
})
