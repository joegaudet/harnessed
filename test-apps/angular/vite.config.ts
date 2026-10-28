import { defineConfig } from 'vite'
import { plugins } from './vite.shared.ts'

// The app's own port for `vite` and `vite preview`, so it can run beside the
// other fixtures' servers.
const port = Number(process.env.FIXTURE_PORT || 5194)

export default defineConfig({
  plugins: plugins('tsconfig.app.json'),
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
  // Every unknown path serves index.html, so /step-two is the app, not a 404.
  appType: 'spa',
  build: { outDir: 'tmp/dist', emptyOutDir: true },
})
