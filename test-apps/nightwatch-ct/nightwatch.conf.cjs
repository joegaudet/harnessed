// Nightwatch component tests: the catalog's component and page specs, run
// against the conformance fixture mounted by a framework's Nightwatch plugin.
// One environment per framework, each with its own plugin, Vite config and
// spec folder: `--env react` mounts the React fixture through
// @nightwatch/react. A port (Vue, through @nightwatch/vue) is another
// environment beside it, with its own vite.<framework>.config.ts and
// <framework>/ folder, and a `test:<framework>` script.
//
// Vite runs outside Nightwatch (start_vite: false; see package.json), on the
// port given here, so the plugin only checks it is up and points its renderer
// page at it.
//
// Chrome only. CHROME_BIN / CHROMEDRIVER_PATH override the browser and driver
// locally; unset, selenium-webdriver's Selenium Manager resolves both.

const env = name => process.env[name] || undefined

module.exports = {
  skip_testcases_on_fail: false,
  output_folder: false,
  usage_analytics: { enabled: false },

  test_settings: {
    default: {
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless=new', '--window-size=1280,800'],
          ...(env('CHROME_BIN') ? { binary: env('CHROME_BIN') } : {}),
        },
      },
      webdriver: { start_process: true, server_path: env('CHROMEDRIVER_PATH') },
      globals: { asyncHookTimeout: 60_000 },
    },

    react: {
      src_folders: ['react'],
      plugins: ['@nightwatch/react'],
      vite_dev_server: { start_vite: false, port: 5196 },
    },
  },
}
