import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The test code runs in Node and drives a real Chrome; nothing here needs a DOM.
    environment: 'node',
    include: ['specs/*.test.ts'],
    globalSetup: ['./specs/serve-fixture.ts'],
    // One browser, one file, one spec at a time: the specs measure "answers
    // immediately" in wall-clock time, which parallel runs would skew.
    pool: 'forks',
    fileParallelism: false,
    // Generous next to the 5s default retry timeout a spec may legitimately wait out.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
