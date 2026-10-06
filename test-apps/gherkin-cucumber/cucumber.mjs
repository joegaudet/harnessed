// The shared harness-world feature, under cucumber-js driving Playwright.
export default {
  paths: ['../../packages/gherkin/features/*.feature'],
  import: ['steps/*.mjs'],
  format: ['progress'],
  strict: true,
}
