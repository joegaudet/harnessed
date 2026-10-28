import { harnessedDecorators } from '@harnessed-ts/core/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/** The app `serve:fixture` builds and serves for the Playwright run. */
export default defineConfig({
  // Must come before the framework plugin: browsers cannot parse `accessor` fields.
  plugins: [harnessedDecorators(), vue()],
  // Every unknown path serves index.html, so /step-two is the app, not a 404.
  appType: 'spa',
})
