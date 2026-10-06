// TestCafe loads this file with require(), so it is CommonJS.
/* global module, require */

module.exports = {
  src: ['conformance.test.ts', 'driver.test.ts'],
  browsers: ['chrome:headless'],
  hostname: '127.0.0.1',
  disableScreenshots: true,
  compilerOptions: {
    typescript: {
      // TestCafe bundles TypeScript 4.9, which cannot parse the workspace's
      // @types/node; compile with the workspace's own. TestCafe pins
      // `moduleResolution` to node10, which TypeScript 6 deprecates.
      customCompilerModulePath: require.resolve('typescript'),
      options: { ignoreDeprecations: '6.0' },
    },
  },
}
