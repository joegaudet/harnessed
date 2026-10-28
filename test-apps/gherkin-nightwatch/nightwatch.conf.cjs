// The shared harness-world feature under Nightwatch's Cucumber runner. The
// runner launches a browser per scenario in its own Before hook and sets it on
// the world; steps/world.mjs turns it into the scenario's env with
// @harnessed-ts/gherkin/nightwatch.
//
// Chrome. CHROME_BIN / CHROMEDRIVER_PATH override the browser and driver
// locally; unset, selenium-webdriver's Selenium Manager resolves both.

const env = name => process.env[name] || undefined

module.exports = {
  src_folders: ['steps'],
  output_folder: false,
  usage_analytics: { enabled: false },

  test_runner: {
    type: 'cucumber',
    options: {
      feature_path: '../../packages/gherkin/features/*.feature',
      // The step file is an ES module: cucumber loads it with --import.
      enable_esm: true,
    },
  },

  test_settings: {
    default: {
      launch_url: 'http://localhost:5199',
    },

    chrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless=new', '--window-size=1280,800'],
          ...(env('CHROME_BIN') ? { binary: env('CHROME_BIN') } : {}),
        },
      },
      webdriver: { start_process: true, server_path: env('CHROMEDRIVER_PATH') },
    },
  },
}
