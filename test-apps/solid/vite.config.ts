import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

/** The app `serve:fixture` builds and serves for the Playwright run. */
export default defineConfig({
  // Must come before the framework plugin: browsers cannot parse `accessor` fields.
  // It leaves JSX alone (esbuild's `jsx: 'preserve'`), so Solid's compiler gets it.
  plugins: [harnessedDecorators(), solid()],
  // Every unknown path serves index.html, so /step-two is the app, not a 404.
  appType: 'spa',
})
