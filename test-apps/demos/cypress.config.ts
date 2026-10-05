import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'cypress'

const RECORDING = process.env.DEMO_RECORD === '1'
/** The runner's window: room for the command log and the app at full size, no more. */
const WINDOW = { width: 1000, height: 750 }

export default defineConfig({
  e2e: {
    // Each run passes the app it drives: `--config baseUrl=...`, React or Ember.
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron') {
          launchOptions.preferences.width = WINDOW.width
          launchOptions.preferences.height = WINDOW.height
        } else if (browser.family === 'chromium') {
          launchOptions.args.push(`--window-size=${WINDOW.width},${WINDOW.height}`)
        }
        return launchOptions
      })
      on('task', {
        /** Writes a recording's step timeline beside its footage. */
        saveTimeline(timeline: { env: string }) {
          const dir = new URL(`./raw/${timeline.env}/`, import.meta.url)
          mkdirSync(dir, { recursive: true })
          writeFileSync(new URL('timeline.json', dir), `${JSON.stringify(timeline, null, 2)}\n`)
          return null
        },
      })
    },
  },
  expose: { DEMO_RECORD: RECORDING ? '1' : '' },
  // The same viewport as the Playwright runs and the RTL replay.
  viewportWidth: 520,
  viewportHeight: 400,
  video: RECORDING,
  videoCompression: false,
  videosFolder: 'raw/cypress-videos',
  screenshotsFolder: 'raw/cypress-screenshots',
})
