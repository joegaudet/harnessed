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
})
