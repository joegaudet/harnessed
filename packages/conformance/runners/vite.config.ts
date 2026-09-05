import { harnessedDecorators } from '@harnessed-ts/core/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('../fixture', import.meta.url).pathname,
  // Browsers cannot parse `accessor` fields either.
  plugins: [harnessedDecorators(), react()],
  server: { port: 5177, strictPort: true },
  // Every unknown path serves index.html, so /step-two is the app, not a 404.
  appType: 'spa',
})
