import { defineConfig } from '@harnessed/core'

// A repo that keeps harnesses somewhere other than the default.
export default defineConfig({
  layout: { harnesses: 'lib/harnesses' },
})
