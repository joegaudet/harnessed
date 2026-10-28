import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import nightwatchPlugin from 'vite-plugin-nightwatch'

/** The renderer's port, so this runner can work beside the others. */
const PORT = 5196

/**
 * @nightwatch/react 3.1 writes a mount script that imports `react-dom` for any
 * React but 18, and renders with `ReactDOM.render` when that namespace has no
 * `createRoot` — which React 19 removed from `react-dom`. Pointing the mount
 * scripts it generates (under nightwatch/.cache) at `react-dom/client` gives
 * them `createRoot`; nothing else is redirected, so the fixture's own
 * `createPortal` and `flushSync` still come from `react-dom`.
 */
function mountScriptsUseReactDomClient(): Plugin {
  return {
    name: 'harnessed:nightwatch-react-19',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source !== 'react-dom' || importer === undefined) return null
      if (!importer.replaceAll('\\', '/').includes('/nightwatch/.cache/')) return null
      return this.resolve('react-dom/client', importer, { skipSelf: true })
    },
  }
}

// Its types mark `renderPage` required; the plugin defaults it to its own page.
const rendererOptions = { componentType: 'react' } as Parameters<typeof nightwatchPlugin>[0]

export default defineConfig({
  plugins: [mountScriptsUseReactDomClient(), react(), nightwatchPlugin(rendererOptions)],
  server: { port: PORT, strictPort: true },
})
