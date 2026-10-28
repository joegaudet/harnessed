import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import nightwatchPlugin from 'vite-plugin-nightwatch'

/** The renderer's port, so this runner can work beside the others. */
const PORT = 5189

/** The plugin that serves @nightwatch/vue's renderer page; see vite.react.config.ts for the cast. */
const renderer = nightwatchPlugin({
  componentType: 'vue',
} as Parameters<typeof nightwatchPlugin>[0]) as unknown as Plugin

export default defineConfig({
  plugins: [vue(), renderer],
  server: { port: PORT, strictPort: true },
  // There is no index.html for Vite to crawl, so it would find the framework
  // only when the first mount asks for it, re-bundle, and reload the renderer
  // page under that mount. Bundle it up front instead.
  optimizeDeps: { entries: ['support/Stage.vue'], include: ['vue'] },
})
