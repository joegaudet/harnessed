import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

/** The app `serve:fixture` builds and serves for the Playwright run. */
export default defineConfig({
  // Must come before the framework plugin: browsers cannot parse `accessor`
  // fields. Its default `include` is .ts/.tsx only, so it never sees a .svelte
  // file (tests/decorators.test.ts holds it to that).
  plugins: [harnessedDecorators(), svelte()],
  // Every unknown path serves index.html, so /step-two is the app, not a 404.
  appType: 'spa',
})
