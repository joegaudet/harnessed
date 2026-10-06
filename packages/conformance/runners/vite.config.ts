import { harnessedDecorators } from '@harnessed-ts/core/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('../fixture', import.meta.url).pathname,
  // Browsers cannot parse `accessor` fields either.
  plugins: [harnessedDecorators(), react()],
  // FIXTURE_PORT lets several drivers' runners serve the fixture at once.
  server: { port: Number(process.env.FIXTURE_PORT || 5177), strictPort: true },
  // Every unknown path serves index.html, so /step-two is the app, not a 404.
  appType: 'spa',
})
